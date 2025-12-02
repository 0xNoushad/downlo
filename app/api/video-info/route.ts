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

    // Sanitize URL input: users may paste placeholders like `<id>` or include surrounding
    // angle brackets. Remove surrounding < > and reject obviously invalid placeholders.
    const sanitizeUrl = (u: any): string | null => {
      if (!u || typeof u !== 'string') return null
      let s = u.trim()
      // Remove surrounding angle brackets
      if (s.startsWith('<') && s.endsWith('>')) s = s.slice(1, -1).trim()
      // Decode common percent-encodings for angle brackets
      s = s.replace(/%3C/gi, '<').replace(/%3E/gi, '>')
      // If it still contains angle bracket characters it's likely a placeholder
      if (s.includes('<') || s.includes('>')) return null
      return s
    }

    const cleanUrl = sanitizeUrl(url)
    if (!cleanUrl) {
      return NextResponse.json({ error: 'Invalid URL', details: 'Please provide a valid video URL (remove angle brackets or placeholders like <id>).' }, { status: 400 })
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

  // Use dump-single-json without forcing a format. Some videos (DASH / separate audio/video)
  // don't expose a `best` single format and forcing `--format best` can make yt-dlp exit
  // with an error. Let yt-dlp report all formats and pick the best client-side.
  // Add --no-config to avoid using any local/global yt-dlp config that may force formats
  const command = `yt-dlp --no-config "${cleanUrl}" --dump-single-json --no-check-certificates --no-warnings --geo-bypass --ignore-errors --user-agent "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"`
    
    console.log('Executing command:', command)

    try {
      const { stdout, stderr } = await execAsync(command, { 
        timeout: 45000, // 45 second timeout for better platform support
        maxBuffer: 1024 * 1024 * 20 // 20MB buffer for large metadata
      })

      if (stderr) {
        console.warn('yt-dlp warnings:', stderr)
      }

      // Defensive parse: yt-dlp may print 'null' on failure; ensure we got an object
      let info: any = null
      try {
        info = JSON.parse(stdout)
      } catch (parseErr) {
        console.error('Failed to parse yt-dlp output:', parseErr, 'stdout:', stdout)
        return NextResponse.json({ error: 'Failed to parse video metadata', details: 'yt-dlp returned invalid JSON' }, { status: 500 })
      }

      if (!info) {
        console.error('yt-dlp returned no metadata (null stdout)')
        return NextResponse.json({ error: 'No metadata returned', details: 'yt-dlp returned no metadata for this URL' }, { status: 500 })
      }
      console.log('Video info retrieved:', {
        title: info.title,
        duration: info.duration,
        extractor: info.extractor,
        formats: info.formats?.length || 0
      })

      // Detect platform from URL or extractor
      const platform = detectPlatform(cleanUrl, info.extractor)
      
      // Calculate estimated file size for the best quality
      const formats = info.formats || []

      // Choose the format with the largest known filesize, else largest tbr/bitrate, else the first
      const bestFormat = formats.reduce((best: any, f: any) => {
        if (!best) return f
        const fSize = Number(f.filesize || f.filesize_approx || 0) || Number(f.tbr || f.bitrate || 0) || 0
        const bestSize = Number(best.filesize || best.filesize_approx || 0) || Number(best.tbr || best.bitrate || 0) || 0
        return fSize > bestSize ? f : best
      }, formats[0])

      const estimatedSize = (() => {
        const fs = bestFormat?.filesize || bestFormat?.filesize_approx
        if (fs) return formatFileSize(Number(fs))
        // If only bitrate (tbr) is available, estimate filesize = tbr(kbps) * duration
        const tbr = bestFormat?.tbr || bestFormat?.bitrate
        if (tbr && info.duration) {
          // tbr is in Kbps (approx). filesize (bytes) = tbr(kbps) * 1000 (bits/sec) / 8 * seconds
          const bytes = (Number(tbr) * 1000 / 8) * Number(info.duration)
          return formatFileSize(bytes)
        }
        return estimateSizeFromDuration(info.duration)
      })()

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

      // If yt-dlp exited with a non-zero code but printed JSON to stdout, try to parse
      const maybeStdout = execError?.stdout
      if (typeof maybeStdout === 'string' && maybeStdout.trim() && maybeStdout.trim() !== 'null') {
        try {
          const info = JSON.parse(maybeStdout)
          // build a best-effort response using the same logic as above
          const platform = detectPlatform(cleanUrl, info.extractor)
          const formats = info.formats || []
          const bestFormat = formats.reduce((best: any, f: any) => {
            if (!best) return f
            const fSize = Number(f.filesize || f.filesize_approx || 0) || Number(f.tbr || f.bitrate || 0) || 0
            const bestSize = Number(best.filesize || best.filesize_approx || 0) || Number(best.tbr || best.bitrate || 0) || 0
            return fSize > bestSize ? f : best
          }, formats[0])

          const estimatedSize = (() => {
            const fs = bestFormat?.filesize || bestFormat?.filesize_approx
            if (fs) return formatFileSize(Number(fs))
            const tbr = bestFormat?.tbr || bestFormat?.bitrate
            if (tbr && info.duration) {
              const bytes = (Number(tbr) * 1000 / 8) * Number(info.duration)
              return formatFileSize(bytes)
            }
            return estimateSizeFromDuration(info.duration)
          })()

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
            uploader: info.uploader || info.channel || 'Unknown',
            uploadDate: info.upload_date ? formatUploadDate(info.upload_date) : null,
            viewCount: info.view_count ? formatViewCount(info.view_count) : null,
            likeCount: info.like_count ? formatNumber(info.like_count) : null,
          })
        } catch (parseErr) {
          console.warn('Could not parse JSON from execError.stdout', parseErr)
          // fall through to friendly error handling below
        }
      }

      if (execError.code === 'ENOENT') {
        return NextResponse.json({ 
          error: 'yt-dlp not found in PATH',
          details: 'Please install yt-dlp: pip install yt-dlp'
        }, { status: 500 })
      }
      // Enhanced error handling for different platforms and known yt-dlp messages
      let userFriendlyError = 'Failed to fetch video information'
      let details = execError.message || 'Unknown error occurred'

      const stderr = execError.stderr || ''
      if (stderr.includes('Requested format is not available')) {
        userFriendlyError = 'Requested format is not available'
        details = 'yt-dlp reported that the requested format is not available for this URL.'

        // Try to fetch available formats to help the client pick a valid one
        try {
          const { stdout: formatsOut } = await execAsync(`yt-dlp "${url}" --list-formats`, {
            timeout: 20000,
            maxBuffer: 1024 * 1024 * 5,
          })

          return NextResponse.json({
            error: userFriendlyError,
            details,
            formatsList: formatsOut || 'No formats returned',
          }, { status: 422 })
        } catch (listErr: any) {
          console.warn('Failed to list formats for URL:', url, listErr)
          return NextResponse.json({ error: userFriendlyError, details: details + ' Also failed to list formats.' }, { status: 422 })
        }
      }

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

      // Return 400 for unsupported/invalid URL formats so clients can correct input
      const statusCode = userFriendlyError === 'This platform or URL format is not supported' ? 400 : 500
      return NextResponse.json({
        error: userFriendlyError,
        details: details
      }, { status: statusCode })
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
    'dailymotion': 'Dailymotion',
    'instagram': 'Instagram',
    'pinterest': 'Pinterest',
    'tiktok': 'TikTok',
    'twitter': 'Twitter',
    'twitter/x': 'Twitter/X',
    'facebook': 'Facebook',
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
    'YouTube': '🎬',
    'Vimeo': '🎥',
    'Dailymotion': '📽️',
    'Instagram': '📱',
    'Pinterest': '🖼️',
    'TikTok': '🎪',
    'Twitter': '🐦',
    'Twitter/X': '🐦',
    'Facebook': '📘',
    'Twitch': '🎮',
    'Reddit': '💬',
    'SoundCloud': '🎵',
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