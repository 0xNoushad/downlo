import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json()
    
    console.log('Video info request for URL:', url)

    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 })
    }

    // Check if yt-dlp is available
    try {
      const { stdout } = await execAsync('yt-dlp --version')
      console.log('yt-dlp version:', stdout.trim())
    } catch (error) {
      console.error('yt-dlp not found:', error)
      return NextResponse.json({ 
        error: 'yt-dlp is not installed or not in PATH. Please install it using: pip install yt-dlp',
        details: 'The yt-dlp binary could not be found on the system.'
      }, { status: 500 })
    }

    // Enhanced command with better platform support and error handling
    const command = `yt-dlp "${url}" --dump-single-json --no-check-certificates --no-warnings --format best --prefer-free-formats --geo-bypass --ignore-errors --user-agent "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"`
    
    console.log('Executing command:', command)

    try {
      const { stdout, stderr } = await execAsync(command, { 
        timeout: 45000, // 45 second timeout for better platform support
        maxBuffer: 1024 * 1024 * 20 // 20MB buffer for large metadata
      })

      if (stderr) {
        console.warn('yt-dlp warnings:', stderr)
      }

      const info = JSON.parse(stdout)
      console.log('Video info retrieved:', {
        title: info.title,
        duration: info.duration,
        extractor: info.extractor,
        formats: info.formats?.length || 0
      })

      // Detect platform from URL or extractor
      const platform = detectPlatform(url, info.extractor)
      
      // Calculate estimated file size for the best quality
      const bestFormat = info.formats?.find((f: any) => 
        f.format_id === 'best' || f.quality === 'best'
      ) || info.formats?.[0]
      
      const estimatedSize = bestFormat?.filesize ? 
        formatFileSize(bestFormat.filesize) : 
        estimateSizeFromDuration(info.duration)

      return NextResponse.json({
        thumbnail: info.thumbnail || info.thumbnails?.[0]?.url || generateDefaultThumbnail(platform),
        title: info.title || 'Untitled Video',
        duration: formatDuration(info.duration),
        platform: platform,
        fileSize: estimatedSize,
        formats: info.formats?.slice(0, 15).map((f: any) => ({
          id: f.format_id,
          ext: f.ext,
          quality: f.format_note || f.height || f.resolution || f.quality || 'unknown',
          filesize: f.filesize,
        })) || [],
        // Additional metadata
        uploader: info.uploader || info.channel || 'Unknown',
        uploadDate: info.upload_date ? formatUploadDate(info.upload_date) : null,
        viewCount: info.view_count ? formatViewCount(info.view_count) : null,
        likeCount: info.like_count ? formatNumber(info.like_count) : null,
      })

    } catch (execError: any) {
      console.error('yt-dlp execution error:', execError)
      
      if (execError.code === 'ENOENT') {
        return NextResponse.json({ 
          error: 'yt-dlp not found in PATH',
          details: 'Please install yt-dlp: pip install yt-dlp'
        }, { status: 500 })
      }

      // Enhanced error handling for different platforms
      let userFriendlyError = 'Failed to fetch video information'
      let details = execError.message || 'Unknown error occurred'

      if (execError.message?.includes('Private video')) {
        userFriendlyError = 'This video is private and cannot be downloaded'
      } else if (execError.message?.includes('Video unavailable')) {
        userFriendlyError = 'Video is unavailable or has been removed'
      } else if (execError.message?.includes('Unsupported URL')) {
        userFriendlyError = 'This platform or URL format is not supported'
      } else if (execError.message?.includes('Sign in to confirm')) {
        userFriendlyError = 'This video requires authentication to view'
      } else if (execError.message?.includes('blocked')) {
        userFriendlyError = 'Content is geo-blocked or restricted'
      } else if (execError.message?.includes('timeout')) {
        userFriendlyError = 'Request timed out - the platform might be slow or unavailable'
      }

      return NextResponse.json({
        error: userFriendlyError,
        details: details
      }, { status: 500 })
    }

  } catch (error: any) {
    console.error('Video-info API error:', error)
    return NextResponse.json({
      error: 'Internal server error',
      details: error.message
    }, { status: 500 })
  }
}

function detectPlatform(url: string, extractor?: string): string {
  const platformMap: Record<string, string> = {
    'youtube': 'YouTube',
    'vimeo': 'Vimeo',
    'dailymotion': ' Dailymotion',
    'instagram': 'Instagram',
    'pinterest': 'Pinterest',
    'tiktok': 'TikTok',
    'twitter/x': ' Twitter/x',
    'facebook': ' Facebook',
    'twitch': 'Twitch',
    'reddit': 'Reddit',
    'soundcloud': 'SoundCloud',
  }

  if (extractor) {
    const extractorLower = extractor.toLowerCase()
    for (const [key, value] of Object.entries(platformMap)) {
      if (extractorLower.includes(key)) {
        return value
      }
    }
  }

  const urlLower = url.toLowerCase()
  for (const [key, value] of Object.entries(platformMap)) {
    if (urlLower.includes(key)) {
      return value
    }
  }

  return '🌐 Unknown Platform'
}

function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return '0:00'
  
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const remainingSeconds = Math.floor(seconds % 60)
  
  return hours > 0
    ? `${hours}:${padZero(minutes)}:${padZero(remainingSeconds)}`
    : `${minutes}:${padZero(remainingSeconds)}`
}

function padZero(num: number): string {
  return num.toString().padStart(2, '0')
}

function formatFileSize(bytes: number): string {
  if (!bytes) return 'Unknown size'
  
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  
  return Math.round((bytes / Math.pow(1024, i)) * 100) / 100 + ' ' + sizes[i]
}

function estimateSizeFromDuration(duration: number): string {
  if (!duration) return 'Unknown size'
  
  // Rough estimate: ~1MB per minute for 720p
  const estimatedMB = Math.round(duration / 60)
  return `~${estimatedMB} MB`
}

function generateDefaultThumbnail(platform: string): string {
  // Return a placeholder or default thumbnail based on platform
  const platformEmojis: Record<string, string> = {
    ' YouTube': '🎬',
    ' Vimeo': '🎥',
    ' Dailymotion': '📽️',
    ' Instagram': '📱',
    ' Pinterest': '🖼️',
    ' TikTok': '🎪',
    ' Twitter/X': '🐦',
    ' Facebook': '📘',
    ' Twitch': '🎮',
    ' Reddit': '💬',
    ' SoundCloud': '🎵',
  }
  
  const emoji = platformEmojis[platform] || '🎬'
  return `data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180" viewBox="0 0 320 180"><rect width="320" height="180" fill="%23f3f4f6"/><text x="160" y="90" font-family="Arial, sans-serif" font-size="60" text-anchor="middle" dy="0.35em">${emoji}</text></svg>`
}

function formatUploadDate(dateStr: string): string {
  if (!dateStr) return ''
  
  // dateStr format: YYYYMMDD
  const year = dateStr.substr(0, 4)
  const month = dateStr.substr(4, 2)
  const day = dateStr.substr(6, 2)
  
  try {
    const date = new Date(`${year}-${month}-${day}`)
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    })
  } catch {
    return dateStr
  }
}

function formatViewCount(count: number): string {
  if (count < 1000) return count.toString()
  if (count < 1000000) return Math.round(count / 1000) + 'K'
  if (count < 1000000000) return Math.round(count / 1000000) + 'M'
  return Math.round(count / 1000000000) + 'B'
}

function formatNumber(num: number): string {
  if (num < 1000) return num.toString()
  if (num < 1000000) return Math.round(num / 1000) + 'K'
  return Math.round(num / 1000000) + 'M'
}