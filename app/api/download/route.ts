import { NextRequest } from 'next/server'
import { createVideoProcessor, getPlatformErrorInfo } from '@/lib/video-processor'
import { dependencyChecker } from '@/lib/dependency-checker'


export async function POST(request: NextRequest) {
  const platform = detectDeploymentPlatform();
  const platformConfig = getPlatformConfig(platform);
  
  // Set up timeout for the entire request based on platform
  const timeoutPromise = new Promise<Response>((_, reject) => {
    setTimeout(() => {
      reject(new Error(`Request timed out after ${platformConfig.timeout}ms`));
    }, platformConfig.timeout);
  });

  try {
    const requestPromise = handleDownloadRequest(request, platform, platformConfig);
    return await Promise.race([requestPromise, timeoutPromise]);
  } catch (error: any) {
    console.error('Download API error:', error);
    
    // Provide platform-aware error handling
    const tools = await dependencyChecker.getAvailableTools().catch(() => ({ ytdlp: 'none', ffmpeg: 'none' }));
    
    if (error.message?.includes('timed out')) {
      const errorInfo = getPlatformErrorInfo(platform, []);
      return Response.json({
        error: 'Request timed out',
        details: `The request exceeded the ${platformConfig.timeout / 1000}s timeout limit for ${platform}`,
        platform: platform,
        availableTools: tools,
        suggestions: [
          ...errorInfo.suggestions,
          'Try downloading a shorter video or smaller file size',
          'Consider using direct download instead of clipping for large videos'
        ]
      }, { status: 408 });
    }
    
    return Response.json({ 
      error: 'Internal server error',
      details: error.message,
      platform: platform,
      availableTools: tools
    }, { status: 500 });
  }
}

async function handleDownloadRequest(request: NextRequest, platform: string, platformConfig: any): Promise<Response> {
  const { url, format, startTime, endTime } = await request.json();
  
  console.log('Download request:', { url, format, startTime, endTime, platform });

  if (!url) {
    return Response.json({ error: 'URL is required' }, { status: 400 });
  }

  // Validate input parameters based on platform limitations
  const validationError = validateDownloadRequest(url, format, startTime, endTime, platformConfig);
  if (validationError) {
    return validationError;
  }

  // Create video processor based on available tools and platform
  let videoProcessor;
  try {
    videoProcessor = await createVideoProcessor();
  } catch (error: any) {
    console.error('Failed to create video processor:', error);
    
    // Get platform-specific error information
    const tools = await dependencyChecker.getAvailableTools();
    const missingTools = [];
    
    if (tools.ytdlp === 'none') missingTools.push('yt-dlp');
    if (tools.ffmpeg === 'none') missingTools.push('ffmpeg');
    
    const errorInfo = getPlatformErrorInfo(platform, missingTools);
    
    return Response.json({
      error: errorInfo.error,
      details: error.message,
      platform: platform,
      availableTools: tools,
      suggestions: errorInfo.suggestions
    }, { status: 500 });
  }

  // Check if processor is available
  const isAvailable = await videoProcessor.isAvailable();
  if (!isAvailable) {
    const tools = await dependencyChecker.getAvailableTools();
    const errorInfo = getPlatformErrorInfo(platform, []);
    
    return Response.json({
      error: 'Video processor is not available',
      details: 'Required dependencies are not properly configured',
      platform: platform,
      availableTools: tools,
      suggestions: errorInfo.suggestions
    }, { status: 500 });
  }

  // Determine download type and check platform support
  const needsClipping = !!(startTime || endTime);
  const isAudioOnly = format?.includes('audio');

  // Check if clipping is supported on this platform
  if (needsClipping && !platformConfig.supportsClipping) {
    const tools = await dependencyChecker.getAvailableTools();
    return Response.json({
      error: 'Video clipping is not supported on this platform',
      details: 'ffmpeg is not available or configured for video processing',
      platform: platform,
      availableTools: tools,
      suggestions: [
        'Use direct download instead of clipping',
        'Deploy to a platform that supports ffmpeg (Railway, Docker)',
        'Install ffmpeg-static package for Vercel deployment'
      ]
    }, { status: 501 });
  }

  if (isAudioOnly) {
    console.log('Audio download requested');
    return await handleAudioDownload(videoProcessor, url, format, platformConfig);
  } else if (needsClipping) {
    console.log('Clipping requested - using video processor');
    return await handleClippedDownload(videoProcessor, url, format, startTime, endTime, platformConfig);
  } else {
    console.log('Direct download requested');
    return await handleDirectDownload(videoProcessor, url, format, platformConfig);
  }
}

async function handleDirectDownload(videoProcessor: any, url: string, format: string, platformConfig: any): Promise<Response> {
  try {
    console.log('Starting direct download with video processor');
    
    const downloadOptions = {
      format: format || 'best'
    };

    const buffer = await videoProcessor.downloadVideo(url, downloadOptions);
    
    const isAudio = format?.includes('audio');
    const contentType = isAudio ? 'audio/mpeg' : 'video/mp4';
    const extension = isAudio ? 'mp3' : 'mp4';
    
    return new Response(buffer, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="download.${extension}"`,
        'Content-Length': buffer.length.toString(),
      },
    });

  } catch (error: any) {
    console.error('Direct download failed:', error);
    
    const platform = detectDeploymentPlatform();
    const tools = await dependencyChecker.getAvailableTools().catch(() => ({ ytdlp: 'none', ffmpeg: 'none' }));
    
    // Provide user-friendly error messages with platform-specific suggestions
    let userFriendlyError = 'Download failed';
    let suggestions: string[] = [];
    
    if (error.message?.includes('Private video')) {
      userFriendlyError = 'This video is private and cannot be downloaded';
      suggestions = ['Try a different video that is publicly available'];
    } else if (error.message?.includes('Video unavailable')) {
      userFriendlyError = 'Video is unavailable or has been removed';
      suggestions = ['Check if the video URL is correct', 'Try a different video'];
    } else if (error.message?.includes('Unsupported URL')) {
      userFriendlyError = 'This platform or URL format is not supported';
      suggestions = ['Try a supported platform like YouTube, Vimeo, or TikTok'];
    } else if (error.message?.includes('blocked')) {
      userFriendlyError = 'Content is geo-blocked or restricted';
      suggestions = ['This content may not be available in your region'];
    } else if (error.message?.includes('timeout')) {
      userFriendlyError = 'Request timed out - the platform might be slow or unavailable';
      suggestions = [
        'Try again in a few minutes',
        'Try a shorter video or different format',
        `Current timeout limit: ${platformConfig.timeout / 1000}s for ${platform}`
      ];
    } else if (error.message?.includes('package not available')) {
      const errorInfo = getPlatformErrorInfo(platform, ['yt-dlp']);
      userFriendlyError = 'Video processing dependencies are not available';
      suggestions = errorInfo.suggestions;
    }

    return Response.json({ 
      error: userFriendlyError,
      details: error.message,
      platform: platform,
      availableTools: tools,
      suggestions: suggestions,
      platformLimits: {
        maxFileSize: `${Math.round(platformConfig.maxFileSize / 1024 / 1024)}MB`,
        timeout: `${platformConfig.timeout / 1000}s`
      }
    }, { status: 500 });
  }
}

async function handleClippedDownload(
  videoProcessor: any,
  url: string, 
  format: string, 
  startTime: string, 
  endTime: string,
  platformConfig: any
): Promise<Response> {
  try {
    console.log('Starting clipped download with video processor');
    
    const downloadOptions = {
      format: format || 'best',
      startTime: startTime,
      endTime: endTime
    };

    const buffer = await videoProcessor.downloadVideo(url, downloadOptions);
    
    const isAudio = format?.includes('audio');
    const contentType = isAudio ? 'audio/mpeg' : 'video/mp4';
    const extension = isAudio ? 'mp3' : 'mp4';

    return new Response(buffer, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="clip.${extension}"`,
        'Content-Length': buffer.length.toString(),
        'X-Clipping-Status': 'server-side-clipped',
      },
    });

  } catch (error: any) {
    console.error('Clipped download failed:', error);
    
    const platform = detectDeploymentPlatform();
    const tools = await dependencyChecker.getAvailableTools().catch(() => ({ ytdlp: 'none', ffmpeg: 'none' }));
    
    // Provide user-friendly error messages with platform-specific suggestions
    let userFriendlyError = 'Video clipping failed';
    let suggestions: string[] = [];
    
    // Check if it's an ffmpeg availability issue
    if (error.message.includes('ffmpeg')) {
      const errorInfo = getPlatformErrorInfo(platform, ['ffmpeg']);
      userFriendlyError = 'ffmpeg is required for video clipping but is not available';
      suggestions = [
        ...errorInfo.suggestions,
        'Use direct download instead of clipping',
        'Try a different deployment platform that supports ffmpeg'
      ];
      
      return Response.json({
        error: userFriendlyError,
        details: error.message,
        platform: platform,
        availableTools: tools,
        suggestions: suggestions,
        fallbackOptions: ['Direct download without clipping']
      }, { status: 501 });
    }

    if (error.message?.includes('Private video')) {
      userFriendlyError = 'This video is private and cannot be downloaded';
      suggestions = ['Try a different video that is publicly available'];
    } else if (error.message?.includes('Video unavailable')) {
      userFriendlyError = 'Video is unavailable or has been removed';
      suggestions = ['Check if the video URL is correct', 'Try a different video'];
    } else if (error.message?.includes('timeout')) {
      userFriendlyError = 'Clipping timed out - try a shorter clip or smaller video';
      suggestions = [
        'Reduce the clip duration',
        'Try a lower quality format',
        `Current timeout limit: ${platformConfig.timeout / 1000}s for ${platform}`,
        'Use direct download instead of clipping'
      ];
    } else if (error.message?.includes('duration')) {
      userFriendlyError = 'Clip duration exceeds platform limits';
      suggestions = [
        `Maximum clip duration: ${Math.floor(platformConfig.maxDuration / 60)} minutes`,
        'Reduce the clip length',
        'Use direct download for longer videos'
      ];
    }

    return Response.json({
      error: userFriendlyError,
      details: error.message,
      platform: platform,
      availableTools: tools,
      suggestions: suggestions,
      platformLimits: {
        maxDuration: `${Math.floor(platformConfig.maxDuration / 60)} minutes`,
        maxFileSize: `${Math.round(platformConfig.maxFileSize / 1024 / 1024)}MB`,
        timeout: `${platformConfig.timeout / 1000}s`
      }
    }, { status: 500 });
  }
}

async function handleAudioDownload(videoProcessor: any, url: string, format: string, platformConfig: any): Promise<Response> {
  try {
    console.log('Starting audio download with video processor');
    
    // Use audio-specific format if not already specified
    const audioFormat = format?.includes('audio') ? format : 'bestaudio/best';
    
    const downloadOptions = {
      format: audioFormat
    };

    const buffer = await videoProcessor.downloadVideo(url, downloadOptions);
    
    return new Response(buffer, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Disposition': 'attachment; filename="audio.mp3"',
        'Content-Length': buffer.length.toString(),
      },
    });

  } catch (error: any) {
    console.error('Audio download failed:', error);
    
    const platform = detectDeploymentPlatform();
    const tools = await dependencyChecker.getAvailableTools().catch(() => ({ ytdlp: 'none', ffmpeg: 'none' }));
    
    // Provide user-friendly error messages with platform-specific suggestions
    let userFriendlyError = 'Audio download failed';
    let suggestions: string[] = [];
    
    if (error.message?.includes('Private video')) {
      userFriendlyError = 'This video is private and cannot be downloaded';
      suggestions = ['Try a different video that is publicly available'];
    } else if (error.message?.includes('Video unavailable')) {
      userFriendlyError = 'Video is unavailable or has been removed';
      suggestions = ['Check if the video URL is correct', 'Try a different video'];
    } else if (error.message?.includes('No audio')) {
      userFriendlyError = 'No audio track available for this video';
      suggestions = [
        'This video may not have an audio track',
        'Try downloading the video instead of audio only',
        'Check if the video has sound when played normally'
      ];
    } else if (error.message?.includes('timeout')) {
      userFriendlyError = 'Audio download timed out';
      suggestions = [
        'Try again in a few minutes',
        'Try a different audio format',
        `Current timeout limit: ${platformConfig.timeout / 1000}s for ${platform}`
      ];
    } else if (error.message?.includes('package not available')) {
      const errorInfo = getPlatformErrorInfo(platform, ['yt-dlp']);
      userFriendlyError = 'Audio processing dependencies are not available';
      suggestions = errorInfo.suggestions;
    }

    return Response.json({
      error: userFriendlyError,
      details: error.message,
      platform: platform,
      availableTools: tools,
      suggestions: suggestions,
      platformLimits: {
        maxFileSize: `${Math.round(platformConfig.maxFileSize / 1024 / 1024)}MB`,
        timeout: `${platformConfig.timeout / 1000}s`
      }
    }, { status: 500 });
  }
}

/**
 * Detect the deployment platform
 */
function detectDeploymentPlatform(): string {
  // Check environment variables for platform detection
  if (process.env.VERCEL) {
    return 'vercel';
  }
  
  if (process.env.RAILWAY_ENVIRONMENT) {
    return 'railway';
  }
  
  if (process.env.RENDER) {
    return 'render';
  }
  
  if (process.env.NODE_ENV === 'production') {
    return 'production';
  }
  
  return 'local';
}

/**
 * Get platform-specific configuration
 */
function getPlatformConfig(platform: string) {
  const configs = {
    vercel: {
      timeout: 30000, // 30 seconds for Vercel serverless functions
      maxFileSize: 50 * 1024 * 1024, // 50MB limit
      maxDuration: 600, // 10 minutes max video duration
      supportsClipping: true, // With ffmpeg-static package
      memoryLimit: '1024mb'
    },
    railway: {
      timeout: 300000, // 5 minutes for Railway
      maxFileSize: 500 * 1024 * 1024, // 500MB limit
      maxDuration: 3600, // 1 hour max video duration
      supportsClipping: true,
      memoryLimit: '2048mb'
    },
    render: {
      timeout: 300000, // 5 minutes for Render
      maxFileSize: 200 * 1024 * 1024, // 200MB limit
      maxDuration: 1800, // 30 minutes max video duration
      supportsClipping: true,
      memoryLimit: '1024mb'
    },
    local: {
      timeout: 600000, // 10 minutes for local development
      maxFileSize: 1024 * 1024 * 1024, // 1GB limit
      maxDuration: 7200, // 2 hours max video duration
      supportsClipping: true,
      memoryLimit: '4096mb'
    },
    production: {
      timeout: 180000, // 3 minutes for generic production
      maxFileSize: 100 * 1024 * 1024, // 100MB limit
      maxDuration: 1200, // 20 minutes max video duration
      supportsClipping: true,
      memoryLimit: '1024mb'
    }
  };

  return configs[platform as keyof typeof configs] || configs.production;
}

/**
 * Validate download request based on platform limitations
 */
function validateDownloadRequest(url: string, format: string, startTime: string, endTime: string, platformConfig: any): Response | null {
  // Validate URL format
  try {
    new URL(url);
  } catch {
    return Response.json({
      error: 'Invalid URL format',
      details: 'Please provide a valid video URL'
    }, { status: 400 });
  }

  // Validate time format if clipping is requested
  if (startTime || endTime) {
    const timeRegex = /^(\d{1,2}:)?[0-5]?\d:[0-5]\d$/;
    
    if (startTime && !timeRegex.test(startTime)) {
      return Response.json({
        error: 'Invalid start time format',
        details: 'Use format MM:SS or HH:MM:SS'
      }, { status: 400 });
    }
    
    if (endTime && !timeRegex.test(endTime)) {
      return Response.json({
        error: 'Invalid end time format',
        details: 'Use format MM:SS or HH:MM:SS'
      }, { status: 400 });
    }

    // Validate time logic
    if (startTime && endTime) {
      const startSeconds = parseTimeToSeconds(startTime);
      const endSeconds = parseTimeToSeconds(endTime);
      
      if (startSeconds && endSeconds && startSeconds >= endSeconds) {
        return Response.json({
          error: 'Invalid time range',
          details: 'Start time must be before end time'
        }, { status: 400 });
      }

      // Check if duration exceeds platform limits
      if (startSeconds && endSeconds) {
        const duration = endSeconds - startSeconds;
        if (duration > platformConfig.maxDuration) {
          return Response.json({
            error: 'Clip duration too long',
            details: `Maximum clip duration is ${Math.floor(platformConfig.maxDuration / 60)} minutes for this platform`,
            platform: detectDeploymentPlatform(),
            suggestions: [
              'Reduce the clip duration',
              'Use direct download instead of clipping',
              'Deploy to a platform with higher limits'
            ]
          }, { status: 413 });
        }
      }
    }
  }

  return null;
}

/**
 * Parse time string to seconds
 */
function parseTimeToSeconds(timeStr: string): number | null {
  if (!timeStr) return null;
  
  const parts = timeStr.split(':').map(Number);
  if (parts.some(isNaN)) return null;
  
  if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  } else if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  return null;
}