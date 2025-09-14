export interface PlatformConfig {
    platform: 'vercel' | 'railway' | 'docker' | 'local' | 'unknown';
    maxFileSize: number;
    timeout: number;
    maxDuration: number;
    supportedFormats: string[];
    features: {
        videoDownload: boolean;
        audioExtraction: boolean;
        videoClipping: boolean;
        thumbnailGeneration: boolean;
        formatConversion: boolean;
    };
    memoryLimit: number;
    concurrentJobs: number;
}

export interface DeploymentConfig {
    platform: string;
    dependencies: {
        ytdlp: 'system' | 'package' | 'unavailable';
        ffmpeg: 'system' | 'package' | 'unavailable';
    };
    limitations: {
        maxFileSize: number;
        maxDuration: number;
        supportedFormats: string[];
    };
}

// Platform-specific configurations
const PLATFORM_CONFIGS: Record<string, PlatformConfig> = {
    vercel: {
        platform: 'vercel',
        maxFileSize: 50 * 1024 * 1024, // 50MB
        timeout: 30000, // 30 seconds
        maxDuration: 600, // 10 minutes
        supportedFormats: ['mp4', 'webm', 'mp3', 'm4a'],
        features: {
            videoDownload: true,
            audioExtraction: true,
            videoClipping: true,
            thumbnailGeneration: true,
            formatConversion: true,
        },
        memoryLimit: 1024, // 1GB
        concurrentJobs: 1,
    },
    railway: {
        platform: 'railway',
        maxFileSize: 500 * 1024 * 1024, // 500MB
        timeout: 300000, // 5 minutes
        maxDuration: 3600, // 1 hour
        supportedFormats: ['mp4', 'webm', 'avi', 'mkv', 'mp3', 'm4a', 'wav', 'flac'],
        features: {
            videoDownload: true,
            audioExtraction: true,
            videoClipping: true,
            thumbnailGeneration: true,
            formatConversion: true,
        },
        memoryLimit: 4096, // 4GB
        concurrentJobs: 3,
    },
    docker: {
        platform: 'docker',
        maxFileSize: 1024 * 1024 * 1024, // 1GB
        timeout: 600000, // 10 minutes
        maxDuration: 7200, // 2 hours
        supportedFormats: ['mp4', 'webm', 'avi', 'mkv', 'mov', 'mp3', 'm4a', 'wav', 'flac', 'ogg'],
        features: {
            videoDownload: true,
            audioExtraction: true,
            videoClipping: true,
            thumbnailGeneration: true,
            formatConversion: true,
        },
        memoryLimit: 8192, // 8GB
        concurrentJobs: 5,
    },
    local: {
        platform: 'local',
        maxFileSize: 2 * 1024 * 1024 * 1024, // 2GB
        timeout: 1800000, // 30 minutes
        maxDuration: 14400, // 4 hours
        supportedFormats: ['mp4', 'webm', 'avi', 'mkv', 'mov', 'flv', 'mp3', 'm4a', 'wav', 'flac', 'ogg', 'aac'],
        features: {
            videoDownload: true,
            audioExtraction: true,
            videoClipping: true,
            thumbnailGeneration: true,
            formatConversion: true,
        },
        memoryLimit: 16384, // 16GB
        concurrentJobs: 10,
    },
    unknown: {
        platform: 'unknown',
        maxFileSize: 10 * 1024 * 1024, // 10MB (conservative)
        timeout: 15000, // 15 seconds
        maxDuration: 300, // 5 minutes
        supportedFormats: ['mp4', 'mp3'],
        features: {
            videoDownload: true,
            audioExtraction: false,
            videoClipping: false,
            thumbnailGeneration: false,
            formatConversion: false,
        },
        memoryLimit: 512, // 512MB
        concurrentJobs: 1,
    },
};

/**
 * Get platform configuration based on environment variables and runtime detection
 */
export function getPlatformConfig(): PlatformConfig {
    const detectedPlatform = detectDeploymentPlatform();
    const envPlatform = process.env.DEPLOYMENT_PLATFORM as keyof typeof PLATFORM_CONFIGS;

    // Use environment variable if set and valid, otherwise use detected platform
    const platform = (envPlatform && PLATFORM_CONFIGS[envPlatform]) ? envPlatform : detectedPlatform;

    const baseConfig = PLATFORM_CONFIGS[platform] || PLATFORM_CONFIGS.unknown;

    // Override with environment variables if provided
    return {
        ...baseConfig,
        maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '') || baseConfig.maxFileSize,
        timeout: parseInt(process.env.PROCESSING_TIMEOUT || '') || baseConfig.timeout,
        maxDuration: parseInt(process.env.MAX_DURATION || '') || baseConfig.maxDuration,
        memoryLimit: parseInt(process.env.MEMORY_LIMIT || '') || baseConfig.memoryLimit,
        concurrentJobs: parseInt(process.env.CONCURRENT_JOBS || '') || baseConfig.concurrentJobs,
    };
}

/**
 * Detect the deployment platform based on environment variables
 */
function detectDeploymentPlatform(): keyof typeof PLATFORM_CONFIGS {
    // Vercel detection
    if (process.env.VERCEL || process.env.VERCEL_ENV) {
        return 'vercel';
    }

    // Railway detection
    if (process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_PROJECT_ID) {
        return 'railway';
    }

    // Docker detection
    if (process.env.DOCKER_CONTAINER || process.env.KUBERNETES_SERVICE_HOST) {
        return 'docker';
    }

    // Local development detection
    if (process.env.NODE_ENV === 'development' || !process.env.NODE_ENV) {
        return 'local';
    }

    return 'unknown';
}

/**
 * Enhanced platform detection with additional checks
 */
export function detectDeploymentPlatformDetailed(): {
    platform: keyof typeof PLATFORM_CONFIGS;
    confidence: 'high' | 'medium' | 'low';
    indicators: string[];
    capabilities: {
        hasSystemBinaries: boolean;
        hasPackageSupport: boolean;
        supportsLongRunning: boolean;
        hasFileSystem: boolean;
    };
} {
    const indicators: string[] = [];
    let platform: keyof typeof PLATFORM_CONFIGS = 'unknown';
    let confidence: 'high' | 'medium' | 'low' = 'low';

    // Vercel detection
    if (process.env.VERCEL || process.env.VERCEL_ENV) {
        platform = 'vercel';
        confidence = 'high';
        indicators.push('VERCEL environment variable detected');
        if (process.env.VERCEL_ENV) indicators.push(`Vercel environment: ${process.env.VERCEL_ENV}`);
        if (process.env.VERCEL_REGION) indicators.push(`Vercel region: ${process.env.VERCEL_REGION}`);
    }
    // Railway detection
    else if (process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_PROJECT_ID) {
        platform = 'railway';
        confidence = 'high';
        indicators.push('Railway environment variables detected');
        if (process.env.RAILWAY_ENVIRONMENT) indicators.push(`Railway environment: ${process.env.RAILWAY_ENVIRONMENT}`);
        if (process.env.RAILWAY_SERVICE_NAME) indicators.push(`Railway service: ${process.env.RAILWAY_SERVICE_NAME}`);
    }
    // Render detection
    else if (process.env.RENDER || process.env.RENDER_SERVICE_ID) {
        platform = 'docker'; // Treat Render similar to Docker
        confidence = 'high';
        indicators.push('Render environment detected');
        if (process.env.RENDER_SERVICE_TYPE) indicators.push(`Render service type: ${process.env.RENDER_SERVICE_TYPE}`);
    }
    // Heroku detection
    else if (process.env.DYNO || process.env.HEROKU_APP_NAME) {
        platform = 'docker'; // Treat Heroku similar to Docker
        confidence = 'high';
        indicators.push('Heroku environment detected');
        if (process.env.DYNO) indicators.push(`Heroku dyno: ${process.env.DYNO}`);
    }
    // Docker/Kubernetes detection
    else if (process.env.DOCKER_CONTAINER || process.env.KUBERNETES_SERVICE_HOST || process.env.HOSTNAME?.startsWith('docker-')) {
        platform = 'docker';
        confidence = 'high';
        indicators.push('Docker/Kubernetes environment detected');
        if (process.env.KUBERNETES_SERVICE_HOST) indicators.push('Kubernetes detected');
        if (process.env.DOCKER_CONTAINER) indicators.push('Docker container detected');
    }
    // AWS Lambda detection
    else if (process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.LAMBDA_RUNTIME_DIR) {
        platform = 'vercel'; // Treat Lambda similar to Vercel (serverless)
        confidence = 'medium';
        indicators.push('AWS Lambda environment detected');
    }
    // Google Cloud Functions detection
    else if (process.env.FUNCTION_NAME || process.env.GCP_PROJECT) {
        platform = 'vercel'; // Treat GCF similar to Vercel (serverless)
        confidence = 'medium';
        indicators.push('Google Cloud Functions environment detected');
    }
    // Local development detection
    else if (process.env.NODE_ENV === 'development' || !process.env.NODE_ENV) {
        platform = 'local';
        confidence = 'medium';
        indicators.push('Local development environment detected');
        if (!process.env.NODE_ENV) indicators.push('NODE_ENV not set');
    }
    // Production but unknown platform
    else if (process.env.NODE_ENV === 'production') {
        platform = 'unknown';
        confidence = 'low';
        indicators.push('Production environment but platform unknown');
    }

    // Determine capabilities based on platform
    const capabilities = getPlatformCapabilities(platform);

    return {
        platform,
        confidence,
        indicators,
        capabilities,
    };
}

/**
 * Get platform capabilities
 */
function getPlatformCapabilities(platform: keyof typeof PLATFORM_CONFIGS) {
    switch (platform) {
        case 'vercel':
            return {
                hasSystemBinaries: false,
                hasPackageSupport: true,
                supportsLongRunning: false,
                hasFileSystem: false, // Temporary filesystem only
            };
        case 'railway':
            return {
                hasSystemBinaries: true,
                hasPackageSupport: true,
                supportsLongRunning: true,
                hasFileSystem: true,
            };
        case 'docker':
            return {
                hasSystemBinaries: true,
                hasPackageSupport: true,
                supportsLongRunning: true,
                hasFileSystem: true,
            };
        case 'local':
            return {
                hasSystemBinaries: true,
                hasPackageSupport: true,
                supportsLongRunning: true,
                hasFileSystem: true,
            };
        default:
            return {
                hasSystemBinaries: false,
                hasPackageSupport: false,
                supportsLongRunning: false,
                hasFileSystem: false,
            };
    }
}

/**
 * Get runtime configuration based on detected platform
 */
export function getRuntimeConfiguration() {
    const detection = detectDeploymentPlatformDetailed();
    const config = getPlatformConfig();

    return {
        platform: detection.platform,
        confidence: detection.confidence,
        indicators: detection.indicators,
        capabilities: detection.capabilities,
        config,
        features: getAvailableFeatures(detection.platform, detection.capabilities),
        recommendations: getPlatformRecommendations(detection.platform, detection.confidence),
    };
}

/**
 * Get available features based on platform and capabilities
 */
function getAvailableFeatures(platform: keyof typeof PLATFORM_CONFIGS, capabilities: ReturnType<typeof getPlatformCapabilities>) {
    const baseFeatures = PLATFORM_CONFIGS[platform]?.features || PLATFORM_CONFIGS.unknown.features;

    // Adjust features based on actual capabilities
    return {
        ...baseFeatures,
        videoClipping: baseFeatures.videoClipping && (capabilities.hasSystemBinaries || capabilities.hasPackageSupport),
        formatConversion: baseFeatures.formatConversion && (capabilities.hasSystemBinaries || capabilities.hasPackageSupport),
        thumbnailGeneration: baseFeatures.thumbnailGeneration && (capabilities.hasSystemBinaries || capabilities.hasPackageSupport),
        longRunningJobs: capabilities.supportsLongRunning,
        fileSystemAccess: capabilities.hasFileSystem,
    };
}

/**
 * Get platform-specific recommendations
 */
function getPlatformRecommendations(platform: keyof typeof PLATFORM_CONFIGS, confidence: 'high' | 'medium' | 'low'): string[] {
    const recommendations: string[] = [];

    if (confidence === 'low') {
        recommendations.push('Platform detection confidence is low. Consider setting DEPLOYMENT_PLATFORM environment variable.');
    }

    switch (platform) {
        case 'vercel':
            recommendations.push('Vercel detected. Using package-based video processing.');
            recommendations.push('File size limited to 50MB due to serverless constraints.');
            recommendations.push('Consider Railway or Docker for larger files and longer processing times.');
            break;
        case 'railway':
            recommendations.push('Railway detected. System binaries should be available.');
            recommendations.push('Ensure nixpacks.toml includes yt-dlp and ffmpeg dependencies.');
            break;
        case 'docker':
            recommendations.push('Docker environment detected. Ensure Dockerfile includes required binaries.');
            recommendations.push('Full feature set should be available with proper configuration.');
            break;
        case 'local':
            recommendations.push('Local development detected. Install yt-dlp and ffmpeg for full functionality.');
            break;
        case 'unknown':
            recommendations.push('Unknown platform detected. Limited functionality available.');
            recommendations.push('Set DEPLOYMENT_PLATFORM environment variable for better configuration.');
            recommendations.push('Consider deploying to a supported platform.');
            break;
    }

    return recommendations;
}

/**
 * Get deployment configuration with dependency information
 */
export function getDeploymentConfig(): DeploymentConfig {
    const platformConfig = getPlatformConfig();

    return {
        platform: platformConfig.platform,
        dependencies: {
            ytdlp: getDependencyType('ytdlp'),
            ffmpeg: getDependencyType('ffmpeg'),
        },
        limitations: {
            maxFileSize: platformConfig.maxFileSize,
            maxDuration: platformConfig.maxDuration,
            supportedFormats: platformConfig.supportedFormats,
        },
    };
}

/**
 * Determine dependency type based on platform and availability
 */
function getDependencyType(tool: 'ytdlp' | 'ffmpeg'): 'system' | 'package' | 'unavailable' {
    const platform = detectDeploymentPlatform();

    switch (platform) {
        case 'vercel':
            // Vercel uses packages
            return 'package';
        case 'railway':
        case 'docker':
        case 'local':
            // These platforms typically have system binaries
            return 'system';
        default:
            return 'unavailable';
    }
}

/**
 * Check if a feature is supported on the current platform
 */
export function isFeatureSupported(feature: keyof PlatformConfig['features']): boolean {
    const config = getPlatformConfig();
    return config.features[feature];
}

/**
 * Get platform-specific error messages and suggestions
 */
export function getPlatformErrorMessages() {
    const platform = detectDeploymentPlatform();

    const ERROR_MESSAGES: Record<keyof typeof PLATFORM_CONFIGS, {
        missingBinary: string;
        packageFallback?: string;
        timeout: string;
        fileSize: string;
        suggestions: string[];
    }> = {
        vercel: {
            missingBinary: 'This feature requires system binaries not available on Vercel. Using JavaScript package fallback.',
            packageFallback: 'Using JavaScript package fallback for video processing.',
            timeout: 'Processing timeout due to Vercel serverless function limits. Try a shorter video or different platform.',
            fileSize: 'File size exceeds Vercel limits. Maximum file size is 50MB.',
            suggestions: [
                'Consider deploying to Railway for larger file support',
                'Use Docker deployment for full feature support',
                'Try processing shorter videos or smaller files',
            ],
        },
        railway: {
            missingBinary: 'System dependencies not installed. Check nixpacks.toml configuration.',
            timeout: 'Processing timeout. Try optimizing your video or increasing timeout limits.',
            fileSize: 'File size exceeds Railway limits. Maximum file size is 500MB.',
            suggestions: [
                'Install yt-dlp and ffmpeg system packages',
                'Check nixpacks.toml for proper dependency configuration',
                'Increase memory allocation if needed',
            ],
        },
        docker: {
            missingBinary: 'Required binaries not found in container. Check Dockerfile.',
            timeout: 'Processing timeout. Consider increasing timeout configuration.',
            fileSize: 'File size exceeds configured limits.',
            suggestions: [
                'Install yt-dlp and ffmpeg in your Docker image',
                'Increase memory and timeout limits in configuration',
                'Use multi-stage builds for optimized containers',
            ],
        },
        local: {
            missingBinary: 'Required binaries not installed on system.',
            timeout: 'Processing timeout. Check system resources.',
            fileSize: 'File size exceeds configured limits.',
            suggestions: [
                'Install yt-dlp: pip install yt-dlp',
                'Install ffmpeg: brew install ffmpeg (macOS) or apt install ffmpeg (Ubuntu)',
                'Check system resources and available disk space',
            ],
        },
        unknown: {
            missingBinary: 'Unable to detect platform. Limited functionality available.',
            timeout: 'Processing timeout on unknown platform.',
            fileSize: 'File size exceeds conservative limits for unknown platform.',
            suggestions: [
                'Set DEPLOYMENT_PLATFORM environment variable',
                'Deploy to a supported platform (Vercel, Railway, Docker)',
                'Check platform documentation for dependency requirements',
            ],
        },
    };

    return ERROR_MESSAGES[platform as keyof typeof ERROR_MESSAGES] || ERROR_MESSAGES.unknown;
}

/**
 * Feature flags for platform-specific capabilities
 */
export class FeatureFlags {
    private static instance: FeatureFlags;
    private flags: Map<string, boolean> = new Map();
    private platform: keyof typeof PLATFORM_CONFIGS;

    private constructor() {
        this.platform = detectDeploymentPlatform();
        this.initializeFlags();
    }

    public static getInstance(): FeatureFlags {
        if (!FeatureFlags.instance) {
            FeatureFlags.instance = new FeatureFlags();
        }
        return FeatureFlags.instance;
    }

    private initializeFlags() {
        const config = PLATFORM_CONFIGS[this.platform] || PLATFORM_CONFIGS.unknown;
        const capabilities = getPlatformCapabilities(this.platform);

        // Core feature flags
        this.flags.set('video_download', config.features.videoDownload);
        this.flags.set('audio_extraction', config.features.audioExtraction);
        this.flags.set('video_clipping', config.features.videoClipping);
        this.flags.set('thumbnail_generation', config.features.thumbnailGeneration);
        this.flags.set('format_conversion', config.features.formatConversion);

        // Platform capability flags
        this.flags.set('system_binaries', capabilities.hasSystemBinaries);
        this.flags.set('package_support', capabilities.hasPackageSupport);
        this.flags.set('long_running_jobs', capabilities.supportsLongRunning);
        this.flags.set('file_system_access', capabilities.hasFileSystem);

        // Advanced feature flags based on environment
        this.flags.set('concurrent_processing', config.concurrentJobs > 1);
        this.flags.set('large_file_support', config.maxFileSize > 100 * 1024 * 1024); // > 100MB
        this.flags.set('extended_timeout', config.timeout > 60000); // > 1 minute

        // Override with environment variables if provided
        this.loadEnvironmentOverrides();
    }

    private loadEnvironmentOverrides() {
        const envFlags = process.env.FEATURE_FLAGS;
        if (envFlags) {
            try {
                const flags = JSON.parse(envFlags);
                Object.entries(flags).forEach(([key, value]) => {
                    if (typeof value === 'boolean') {
                        this.flags.set(key, value);
                    }
                });
            } catch (error) {
                console.warn('Failed to parse FEATURE_FLAGS environment variable:', error);
            }
        }

        // Individual environment variable overrides
        const flagKeys = Array.from(this.flags.keys());
        flagKeys.forEach(key => {
            const envKey = `FEATURE_${key.toUpperCase()}`;
            const envValue = process.env[envKey];
            if (envValue !== undefined) {
                this.flags.set(key, envValue.toLowerCase() === 'true');
            }
        });
    }

    public isEnabled(flag: string): boolean {
        return this.flags.get(flag) || false;
    }

    public getAllFlags(): Record<string, boolean> {
        return Object.fromEntries(this.flags);
    }

    public getPlatform(): string {
        return this.platform;
    }

    public refresh(): void {
        this.flags.clear();
        this.platform = detectDeploymentPlatform();
        this.initializeFlags();
    }
}

/**
 * Convenience function to check if a feature is enabled
 */
export function isFeatureEnabled(flag: string): boolean {
    return FeatureFlags.getInstance().isEnabled(flag);
}

/**
 * Get all feature flags
 */
export function getAllFeatureFlags(): Record<string, boolean> {
    return FeatureFlags.getInstance().getAllFlags();
}

/**
 * Get comprehensive platform information for debugging and monitoring
 */
export function getPlatformInfo() {
    const detection = detectDeploymentPlatformDetailed();
    const config = getPlatformConfig();
    const flags = getAllFeatureFlags();
    const errorMessages = getPlatformErrorMessages();

    return {
        detection,
        config,
        flags,
        errorMessages,
        environment: {
            nodeEnv: process.env.NODE_ENV,
            platform: process.platform,
            nodeVersion: process.version,
            memory: process.memoryUsage(),
        },
        timestamp: new Date().toISOString(),
    };
}