import { NextRequest } from 'next/server'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

export async function POST(request: NextRequest) {
  try {
    const { url, quality = 'best' } = await request.json()
    
    console.log('Thumbnail request:', { url, quality })

    if (!url) {
      return Response.json({ error: 'URL is required' }, { status: 400 })
    }

    // Check if yt-dlp is available
    try {
      await execAsync('yt-dlp --version')
    } catch (error) {
      console.error('yt-dlp not found:', error)
      return Response.json({ 
        error: 'yt-dlp is not installed or not in PATH. Please install it using: pip install yt-dlp',
        details: 'The yt-dlp binary could not be found on the system.'
      }, { status: 500 })
    }

    try {
      // Get thumbnail URLs using yt-dlp
      const command = `yt-dlp "${url}" --list-thumbnails --no-warnings --no-check-certificates --geo-bypass`
      
      const { stdout, stderr } = await execAsync(command, { 
        timeout: 30000,
        maxBuffer: 1024 * 1024 * 5 // 5MB buffer
      })

      if (stderr) {
        console.warn('yt-dlp thumbnail warnings:', stderr)
      }

      // Parse thumbnail list from yt-dlp output
      const thumbnails = parseThumbnailList(stdout)
      
      // Select best thumbnail based on quality preference
      const selectedThumbnail = selectThumbnail(thumbnails, quality)
      
      if (!selectedThumbnail) {
        // Fallback: try to get thumbnail URL from video info
        const infoCommand = `yt-dlp "${url}" --dump-single-json --no-check-certificates --no-warnings --format best`
        const { stdout: infoStdout } = await execAsync(infoCommand, { timeout: 30000 })
        const info = JSON.parse(infoStdout)
        
        if (info.thumbnail) {
          return Response.json({
            thumbnails: [{
              url: info.thumbnail,
              width: 'unknown',
              height: 'unknown',
              quality: 'default'
            }]
          })
        }
        
        throw new Error('No thumbnails found')
      }

      return Response.json({
        thumbnails: thumbnails,
        selected: selectedThumbnail
      })

    } catch (execError: any) {
      console.error('yt-dlp thumbnail error:', execError)
      
      let userFriendlyError = 'Failed to fetch thumbnails'
      
      if (execError.message?.includes('Unsupported URL')) {
        userFriendlyError = 'This platform does not support thumbnail extraction'
      } else if (execError.message?.includes('Private video')) {
        userFriendlyError = 'Cannot access thumbnails from private videos'
      }

      return Response.json({
        error: userFriendlyError,
        details: execError.message
      }, { status: 500 })
    }

  } catch (error: any) {
    console.error('Thumbnail API error:', error)
    return Response.json({ 
      error: 'Internal server error',
      details: error.message 
    }, { status: 500 })
  }
}

function parseThumbnailList(output: string): Array<{url: string, width: string, height: string, quality: string}> {
  const thumbnails: Array<{url: string, width: string, height: string, quality: string}> = []
  
  // Parse yt-dlp thumbnail list output
  const lines = output.split('\n')
  
  for (const line of lines) {
    // Look for lines containing thumbnail URLs
    if (line.includes('http') && (line.includes('.jpg') || line.includes('.png') || line.includes('.webp'))) {
      const parts = line.trim().split(/\s+/)
      
      // Extract URL (usually the last part containing http)
      const urlPart = parts.find(part => part.startsWith('http'))
      if (!urlPart) continue
      
      // Extract dimensions if available
      const dimensionMatch = line.match(/(\d+)x(\d+)/)
      const width = dimensionMatch ? dimensionMatch[1] : 'unknown'
      const height = dimensionMatch ? dimensionMatch[2] : 'unknown'
      
      // Determine quality based on dimensions or URL
      let quality = 'default'
      if (urlPart.includes('maxres')) quality = 'maxres'
      else if (urlPart.includes('hq')) quality = 'high'
      else if (urlPart.includes('mq')) quality = 'medium'
      else if (dimensionMatch) {
        const pixels = parseInt(width) * parseInt(height)
        if (pixels > 900000) quality = 'maxres'
        else if (pixels > 200000) quality = 'high'
        else if (pixels > 50000) quality = 'medium'
      }
      
      thumbnails.push({
        url: urlPart,
        width,
        height,
        quality
      })
    }
  }
  
  return thumbnails
}

function selectThumbnail(thumbnails: Array<{url: string, width: string, height: string, quality: string}>, preferredQuality: string) {
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