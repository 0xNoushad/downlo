import { NextRequest } from 'next/server'
import { createVideoProcessor, getPlatformErrorInfo, type ThumbnailInfo } from '../../lib/video-processor'
import { dependencyChecker } from '../../lib/dependency-checker'

export async function POST(request: NextRequest) {
  try {
    const { url, quality = 'best' } = await request.json()
    
    console.log('Thumbnail request:', { url, quality })

    if (!url) {
      return Response.json({ error: 'URL is required' }, { status: 400 })
    }

    // Check available tools and create appropriate processor
    const tools = await dependencyChecker.getAvailableTools()
    console.log('Available tools for thumbnails:', tools)

    if (tools.ytdlp === 'none') {
      const platform = detectDeploymentPlatform()
      const errorInfo = getPlatformErrorInfo(platform, ['yt-dlp'])
      
      return Response.json({
        error: errorInfo.error,
        details: 'yt-dlp is required for thumbnail extraction but is not available',
        platform,
        availableTools: tools,
        suggestions: errorInfo.suggestions
      }, { status: 500 })
    }

    try {
      // Create video processor using abstraction layer
      const processor = await createVideoProcessor()
      
      // Get thumbnails using the processor
      const thumbnails = await processor.getThumbnails(url, { quality: quality as any })
      
      // Select best thumbnail based on quality preference
      const selectedThumbnail = selectThumbnail(thumbnails, quality)
      
      return Response.json({
        thumbnails: thumbnails,
        selected: selectedThumbnail || thumbnails[0]
      })

    } catch (processorError: any) {
      console.error('Video processor thumbnail error:', processorError)
      
      let userFriendlyError = 'Failed to fetch thumbnails'
      
      if (processorError.message?.includes('Unsupported URL')) {
        userFriendlyError = 'This platform does not support thumbnail extraction'
      } else if (processorError.message?.includes('Private video')) {
        userFriendlyError = 'Cannot access thumbnails from private videos'
      } else if (processorError.message?.includes('not available')) {
        userFriendlyError = 'Video processing tools are not available on this platform'
      }

      // If processor fails, try to generate a fallback thumbnail
      try {
        const fallbackThumbnail = generateFallbackThumbnail(url)
        return Response.json({
          thumbnails: [fallbackThumbnail],
          selected: fallbackThumbnail,
          warning: 'Using fallback thumbnail due to processing error'
        })
      } catch (fallbackError) {
        return Response.json({
          error: userFriendlyError,
          details: processorError.message,
          platform: detectDeploymentPlatform(),
          availableTools: tools
        }, { status: 500 })
      }
    }

  } catch (error: any) {
    console.error('Thumbnail API error:', error)
    return Response.json({ 
      error: 'Internal server error',
      details: error.message 
    }, { status: 500 })
  }
}

function selectThumbnail(thumbnails: ThumbnailInfo[], preferredQuality: string): ThumbnailInfo | null {
  if (thumbnails.length === 0) return null
  
  // Quality priority order
  const qualityOrder = ['maxres', 'high', 'medium', 'default']
  
  // First try to find exact match
  let selected = thumbnails.find(t => t.quality === preferredQuality)
  
  // If not found, try to find best available quality
  if (!selected) {
    for (const quality of qualityOrder) {
      selected = thumbnails.find(t => t.quality === quality)
      if (selected) break
    }
  }
  
  // Fallback to first available
  return selected || thumbnails[0]
}

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

function generateFallbackThumbnail(url: string): ThumbnailInfo {
  // Detect platform from URL
  const platformMap: Record<string, string> = {
    'youtube': 'YouTube',
    'vimeo': 'Vimeo',
    'dailymotion': 'Dailymotion',
    'instagram': 'Instagram',
    'pinterest': 'Pinterest',
    'tiktok': 'TikTok',
    'twitter': 'Twitter/X',
    'facebook': 'Facebook',
    'twitch': 'Twitch',
    'reddit': 'Reddit',
    'soundcloud': 'SoundCloud',
  };

  const urlLower = url.toLowerCase();
  let platform = '🌐 Unknown Platform';
  
  for (const [key, value] of Object.entries(platformMap)) {
    if (urlLower.includes(key)) {
      platform = value;
      break;
    }
  }

  const platformEmojis: Record<string, string> = {
    'YouTube': '🎬',
    'Vimeo': '🎥',
    'Dailymotion': '📽️',
    'Instagram': '📱',
    'Pinterest': '🖼️',
    'TikTok': '🎪',
    'Twitter/X': '🐦',
    'Facebook': '📘',
    'Twitch': '🎮',
    'Reddit': '💬',
    'SoundCloud': '🎵',
  };
  
  const emoji = platformEmojis[platform] || '🎬';
  const fallbackUrl = `data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180" viewBox="0 0 320 180"><rect width="320" height="180" fill="%23f3f4f6"/><text x="160" y="90" font-family="Arial, sans-serif" font-size="60" text-anchor="middle" dy="0.35em">${emoji}</text></svg>`;

  return {
    url: fallbackUrl,
    width: '320',
    height: '180',
    quality: 'default'
  };
}

// GET endpoint to proxy thumbnail downloads (to avoid CORS issues)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const thumbnailUrl = searchParams.get('url')
    const filename = searchParams.get('filename') || 'thumbnail.jpg'
    
    if (!thumbnailUrl) {
      return Response.json({ error: 'Thumbnail URL is required' }, { status: 400 })
    }

    // Fetch the thumbnail
    const response = await fetch(thumbnailUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch thumbnail: ${response.status}`)
    }

    const imageBuffer = await response.arrayBuffer()
    
    return new Response(imageBuffer, {
      headers: {
        'Content-Type': response.headers.get('content-type') || 'image/jpeg',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': imageBuffer.byteLength.toString(),
        'Cache-Control': 'public, max-age=31536000', // Cache for 1 year
      },
    })

  } catch (error: any) {
    console.error('Thumbnail proxy error:', error)
    return Response.json({ 
      error: 'Failed to download thumbnail',
      details: error.message 
    }, { status: 500 })
  }
}