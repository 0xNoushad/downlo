import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createVideoProcessor, getPlatformErrorInfo } from '../../lib/video-processor'
import { dependencyChecker } from '../../lib/dependency-checker'

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json()

    console.log('Video info request for URL:', url)

    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 })
    }

    // Create appropriate video processor based on platform and available tools
    let videoProcessor;
    try {
      videoProcessor = await createVideoProcessor();
    } catch (processorError: any) {
      console.error('Failed to create video processor:', processorError);

      // Get platform-specific error information
      const platform = detectDeploymentPlatform();
      const tools = await dependencyChecker.getAvailableTools();
      const missingTools = [];

      if (tools.ytdlp === 'none') missingTools.push('yt-dlp');
      if (tools.ffmpeg === 'none') missingTools.push('ffmpeg');

      const errorInfo = getPlatformErrorInfo(platform, missingTools);

      return NextResponse.json({
        error: errorInfo.error,
        details: processorError.message,
        platform: platform,
        availableTools: tools,
        suggestions: errorInfo.suggestions
      }, { status: 500 });
    }

    // Get video information using the abstraction layer
    try {
      const videoInfo = await videoProcessor.getVideoInfo(url);

      console.log('Video info retrieved:', {
        title: videoInfo.title,
        duration: videoInfo.duration,
        platform: videoInfo.platform,
        formats: videoInfo.formats?.length || 0
      });

      return NextResponse.json(videoInfo);

    } catch (processingError: any) {
      console.error('Video processing error:', processingError);

      // Enhanced error handling for different platforms
      let userFriendlyError = 'Failed to fetch video information';
      let details = processingError.message || 'Unknown error occurred';

      if (processingError.message?.includes('Private video')) {
        userFriendlyError = 'This video is private and cannot be downloaded';
      } else if (processingError.message?.includes('Video unavailable')) {
        userFriendlyError = 'Video is unavailable or has been removed';
      } else if (processingError.message?.includes('Unsupported URL')) {
        userFriendlyError = 'This platform or URL format is not supported';
      } else if (processingError.message?.includes('Sign in to confirm')) {
        userFriendlyError = 'This video requires authentication to view';
      } else if (processingError.message?.includes('blocked')) {
        userFriendlyError = 'Content is geo-blocked or restricted';
      } else if (processingError.message?.includes('timeout')) {
        userFriendlyError = 'Request timed out - the platform might be slow or unavailable';
      } else if (processingError.message?.includes('not installed') || processingError.message?.includes('not in PATH')) {
        const platform = detectDeploymentPlatform();
        const tools = await dependencyChecker.getAvailableTools();
        const missingTools = [];

        if (tools.ytdlp === 'none') missingTools.push('yt-dlp');
        if (tools.ffmpeg === 'none') missingTools.push('ffmpeg');

        const errorInfo = getPlatformErrorInfo(platform, missingTools);

        return NextResponse.json({
          error: errorInfo.error,
          details: details,
          platform: platform,
          availableTools: tools,
          suggestions: errorInfo.suggestions
        }, { status: 500 });
      }

      return NextResponse.json({
        error: userFriendlyError,
        details: details
      }, { status: 500 });
    }

  } catch (error: any) {
    console.error('Video-info API error:', error);
    return NextResponse.json({
      error: 'Internal server error',
      details: error.message
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