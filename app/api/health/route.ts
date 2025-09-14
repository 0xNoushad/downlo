import { dependencyChecker } from '../../lib/dependency-checker';
import { errorHandler, ErrorCode } from '../../lib/error-handler';
import { getPlatformInfo, getRuntimeConfiguration } from '../../lib/platform-config';
import { NextRequest } from 'next/server';

export interface HealthCheckResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  platform: {
    name: string;
    confidence: 'high' | 'medium' | 'low';
    indicators: string[];
    capabilities: {
      hasSystemBinaries: boolean;
      hasPackageSupport: boolean;
      supportsLongRunning: boolean;
      hasFileSystem: boolean;
    };
  };
  dependencies: {
    ytdlp: {
      status: 'available' | 'unavailable';
      type: 'binary' | 'package' | 'none';
      version?: string;
    };
    ffmpeg: {
      status: 'available' | 'unavailable';
      type: 'binary' | 'package' | 'none';
      version?: string;
    };
  };
  features: {
    videoDownload: boolean;
    audioExtraction: boolean;
    videoClipping: boolean;
    thumbnailGeneration: boolean;
    formatConversion: boolean;
    longRunningJobs: boolean;
    fileSystemAccess: boolean;
  };
  configuration: {
    maxFileSize: number;
    timeout: number;
    maxDuration: number;
    supportedFormats: string[];
    memoryLimit: number;
    concurrentJobs: number;
  };
  system: {
    nodeVersion: string;
    platform: string;
    memory: {
      used: number;
      total: number;
      free: number;
    };
    uptime: number;
  };
  checks: {
    name: string;
    status: 'pass' | 'fail' | 'warn';
    message: string;
    duration: number;
  }[];
  requestId: string;
}

/**
 * GET /api/health - Health check endpoint
 */
export async function GET(request: NextRequest): Promise<Response> {
  const startTime = Date.now();
  const requestId = `health_${startTime}_${Math.random().toString(36).substr(2, 9)}`;
  
  try {
    // Get platform and runtime information
    const platformInfo = getPlatformInfo();
    const runtimeConfig = getRuntimeConfiguration();
    
    // Perform dependency checks
    const checks: HealthCheckResponse['checks'] = [];
    const dependencyResults = await performDependencyChecks(checks);
    
    // Perform system checks
    await performSystemChecks(checks);
    
    // Determine overall health status
    const overallStatus = determineHealthStatus(checks);
    
    const response: HealthCheckResponse = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      platform: {
        name: runtimeConfig.platform,
        confidence: runtimeConfig.confidence,
        indicators: runtimeConfig.indicators,
        capabilities: runtimeConfig.capabilities,
      },
      dependencies: dependencyResults,
      features: runtimeConfig.features,
      configuration: {
        maxFileSize: runtimeConfig.config.maxFileSize,
        timeout: runtimeConfig.config.timeout,
        maxDuration: runtimeConfig.config.maxDuration,
        supportedFormats: runtimeConfig.config.supportedFormats,
        memoryLimit: runtimeConfig.config.memoryLimit,
        concurrentJobs: runtimeConfig.config.concurrentJobs,
      },
      system: {
        nodeVersion: process.version,
        platform: process.platform,
        memory: {
          used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
          total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
          free: Math.round((process.memoryUsage().heapTotal - process.memoryUsage().heapUsed) / 1024 / 1024),
        },
        uptime: Math.round(process.uptime()),
      },
      checks,
      requestId,
    };

    // Return appropriate HTTP status based on health
    const httpStatus = overallStatus === 'healthy' ? 200 : 
                      overallStatus === 'degraded' ? 200 : 503;

    return new Response(JSON.stringify(response, null, 2), {
      status: httpStatus,
      headers: {
        'Content-Type': 'application/json',
        'X-Request-ID': requestId,
        'X-Health-Status': overallStatus,
        'X-Platform': runtimeConfig.platform,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });

  } catch (error) {
    console.error('Health check failed:', error);
    
    const errorResponse = await errorHandler.createError(
      ErrorCode.SYSTEM_ERROR,
      'Health check failed',
      { operation: 'health-check', requestId },
      error as Error
    );

    return errorHandler.createErrorResponse(errorResponse, 503);
  }
}/**
 *
 Perform dependency checks
 */
async function performDependencyChecks(checks: HealthCheckResponse['checks']) {
  const startTime = Date.now();
  
  try {
    const tools = await dependencyChecker.getAvailableTools();
    
    // Check yt-dlp
    const ytdlpCheckStart = Date.now();
    const ytdlpAvailable = await dependencyChecker.checkYtDlp();
    checks.push({
      name: 'yt-dlp availability',
      status: ytdlpAvailable ? 'pass' : 'warn',
      message: ytdlpAvailable 
        ? `yt-dlp available as ${tools.ytdlp}` 
        : 'yt-dlp not available',
      duration: Date.now() - ytdlpCheckStart,
    });

    // Check ffmpeg
    const ffmpegCheckStart = Date.now();
    const ffmpegAvailable = await dependencyChecker.checkFFmpeg();
    checks.push({
      name: 'ffmpeg availability',
      status: ffmpegAvailable ? 'pass' : 'warn',
      message: ffmpegAvailable 
        ? `ffmpeg available as ${tools.ffmpeg}` 
        : 'ffmpeg not available',
      duration: Date.now() - ffmpegCheckStart,
    });

    // Get version information if available
    const ytdlpVersion = await getDependencyVersion('yt-dlp', tools.ytdlp);
    const ffmpegVersion = await getDependencyVersion('ffmpeg', tools.ffmpeg);

    return {
      ytdlp: {
        status: ytdlpAvailable ? 'available' as const : 'unavailable' as const,
        type: tools.ytdlp,
        version: ytdlpVersion,
      },
      ffmpeg: {
        status: ffmpegAvailable ? 'available' as const : 'unavailable' as const,
        type: tools.ffmpeg,
        version: ffmpegVersion,
      },
    };

  } catch (error) {
    checks.push({
      name: 'dependency check',
      status: 'fail',
      message: `Dependency check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      duration: Date.now() - startTime,
    });

    return {
      ytdlp: {
        status: 'unavailable' as const,
        type: 'none' as const,
      },
      ffmpeg: {
        status: 'unavailable' as const,
        type: 'none' as const,
      },
    };
  }
}

/**
 * Perform system checks
 */
async function performSystemChecks(checks: HealthCheckResponse['checks']) {
  // Memory check
  const memoryCheckStart = Date.now();
  const memoryUsage = process.memoryUsage();
  const memoryUsedMB = Math.round(memoryUsage.heapUsed / 1024 / 1024);
  const memoryTotalMB = Math.round(memoryUsage.heapTotal / 1024 / 1024);
  const memoryUsagePercent = (memoryUsedMB / memoryTotalMB) * 100;

  checks.push({
    name: 'memory usage',
    status: memoryUsagePercent > 90 ? 'fail' : memoryUsagePercent > 70 ? 'warn' : 'pass',
    message: `Memory usage: ${memoryUsedMB}MB / ${memoryTotalMB}MB (${memoryUsagePercent.toFixed(1)}%)`,
    duration: Date.now() - memoryCheckStart,
  });

  // Environment variables check
  const envCheckStart = Date.now();
  const requiredEnvVars = ['NODE_ENV'];
  const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);
  
  checks.push({
    name: 'environment variables',
    status: missingEnvVars.length === 0 ? 'pass' : 'warn',
    message: missingEnvVars.length === 0 
      ? 'All required environment variables are set'
      : `Missing environment variables: ${missingEnvVars.join(', ')}`,
    duration: Date.now() - envCheckStart,
  });

  // File system check (basic write test)
  const fsCheckStart = Date.now();
  try {
    // Try to access /tmp directory (available on most platforms)
    const fs = await import('fs/promises');
    const testFile = `/tmp/health-check-${Date.now()}.txt`;
    await fs.writeFile(testFile, 'health check test');
    await fs.unlink(testFile);
    
    checks.push({
      name: 'file system access',
      status: 'pass',
      message: 'File system is accessible',
      duration: Date.now() - fsCheckStart,
    });
  } catch (error) {
    checks.push({
      name: 'file system access',
      status: 'warn',
      message: `File system access limited: ${error instanceof Error ? error.message : 'Unknown error'}`,
      duration: Date.now() - fsCheckStart,
    });
  }
}

/**
 * Get version information for dependencies
 */
async function getDependencyVersion(tool: string, type: 'binary' | 'package' | 'none'): Promise<string | undefined> {
  if (type === 'none') return undefined;

  try {
    if (type === 'binary') {
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);
      
      const command = tool === 'yt-dlp' ? 'yt-dlp --version' : 'ffmpeg -version';
      const { stdout } = await execAsync(command, { timeout: 5000 });
      
      // Extract version from output
      if (tool === 'yt-dlp') {
        return stdout.trim().split('\n')[0];
      } else {
        const match = stdout.match(/ffmpeg version ([^\s]+)/);
        return match ? match[1] : 'unknown';
      }
    } else if (type === 'package') {
      // For packages, try to get version from package.json or module
      if (tool === 'yt-dlp') {
        const ytdlpExec = await import('yt-dlp-exec');
        return 'package-based'; // Package doesn't expose version easily
      } else {
        const ffmpegStatic = await import('ffmpeg-static');
        return 'package-based'; // Package doesn't expose version easily
      }
    }
  } catch (error) {
    return 'version-unknown';
  }

  return undefined;
}

/**
 * Determine overall health status based on individual checks
 */
function determineHealthStatus(checks: HealthCheckResponse['checks']): 'healthy' | 'degraded' | 'unhealthy' {
  const failedChecks = checks.filter(check => check.status === 'fail');
  const warningChecks = checks.filter(check => check.status === 'warn');

  if (failedChecks.length > 0) {
    // If any critical checks fail, system is unhealthy
    const criticalFailures = failedChecks.filter(check => 
      check.name.includes('memory') || check.name.includes('dependency check')
    );
    
    if (criticalFailures.length > 0) {
      return 'unhealthy';
    }
    
    return 'degraded';
  }

  if (warningChecks.length > 0) {
    return 'degraded';
  }

  return 'healthy';
}