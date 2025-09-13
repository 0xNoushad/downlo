import { NextRequest } from 'next/server'
import { spawn, exec } from 'child_process'
import { promisify } from 'util'
import { unlink, access } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'

const execAsync = promisify(exec)

export async function POST(request: NextRequest) {
  try {
    const { url, format, startTime, endTime } = await request.json()
    
    console.log('Download request:', { url, format, startTime, endTime })

    if (!url) {
      return Response.json({ error: 'URL is required' }, { status: 400 })
    }

    // Check if yt-dlp is available
    try {
      const { stdout } = await execAsync('yt-dlp --version')
      console.log('yt-dlp version:', stdout.trim())
    } catch (error) {
      console.error('yt-dlp not found:', error)
      return Response.json({ 
        error: 'yt-dlp is not installed or not in PATH. Please install it using: pip install yt-dlp',
        details: 'The yt-dlp binary could not be found on the system.'
      }, { status: 500 })
    }

    // Convert time format (mm:ss or hh:mm:ss) to seconds
    const parseTimeToSeconds = (timeStr: string): number | null => {
      if (!timeStr) return null
      
      const parts = timeStr.split(':').map(Number)
      if (parts.some(isNaN)) return null
      
      if (parts.length === 2) {
        return parts[0] * 60 + parts[1]
      } else if (parts.length === 3) {
        return parts[0] * 3600 + parts[1] * 60 + parts[2]
      }
      return null
    }

    // For clipping, we'll use a two-step process:
    // 1. Download full video to temp file
    // 2. Use ffmpeg to clip it
    const needsClipping = !!(startTime || endTime)

    if (needsClipping) {
      console.log('Clipping requested - using two-step process')
      return await handleClippedDownload(url, format, startTime, endTime, parseTimeToSeconds)
    } else {
      console.log('No clipping - direct download')
      return await handleDirectDownload(url, format)
    }

  } catch (error: any) {
    console.error('Download API error:', error)
    return Response.json({ 
      error: 'Internal server error',
      details: error.message 
    }, { status: 500 })
  }
}

async function handleDirectDownload(url: string, format: string): Promise<Response> {
  const args = [
    '-f', format || 'best',
    '--no-warnings',
    '--no-check-certificate',
    '--no-playlist',
    '--ignore-errors',
    '--geo-bypass',
    '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    '-o', '-',
    url
  ]

  console.log('Direct download command:', 'yt-dlp', args.join(' '))

  return new Promise<Response>((resolve) => {
    const child = spawn('yt-dlp', args, {
      stdio: ['ignore', 'pipe', 'pipe']
    })

    let errorOutput = ''
    let hasData = false
    let dataChunks: Buffer[] = []

    child.stderr.on('data', (data) => {
      errorOutput += data.toString()
    })

    child.stdout.on('data', (chunk) => {
      hasData = true
      dataChunks.push(chunk)
    })

    child.on('exit', (code) => {
      if (code !== 0 || !hasData) {
        resolve(Response.json({ 
          error: 'Download failed',
          details: errorOutput
        }, { status: 500 }))
        return
      }

      const finalBuffer = Buffer.concat(dataChunks)
      const isAudio = format?.includes('audio')
      const contentType = isAudio ? 'audio/mpeg' : 'video/mp4'
      const extension = isAudio ? 'mp3' : 'mp4'
      
      resolve(new Response(finalBuffer, {
        headers: {
          'Content-Type': contentType,
          'Content-Disposition': `attachment; filename="download.${extension}"`,
          'Content-Length': finalBuffer.length.toString(),
        },
      }))
    })
  })
}

async function handleClippedDownload(
  url: string, 
  format: string, 
  startTime: string, 
  endTime: string,
  parseTimeToSeconds: (timeStr: string) => number | null
): Promise<Response> {
  const tempDir = tmpdir()
  const tempVideoPath = join(tempDir, `temp_video_${Date.now()}.mp4`)
  const tempClipPath = join(tempDir, `temp_clip_${Date.now()}.mp4`)

  try {
    // Step 1: Download video to temporary file
    console.log('Step 1: Downloading video to temp file')
    const downloadArgs = [
      '-f', format || 'best',
      '--no-warnings',
      '--no-check-certificate',
      '--no-playlist',
      '--ignore-errors',
      '--geo-bypass',
      '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      '-o', tempVideoPath,
      url
    ]

    await new Promise<void>((resolve, reject) => {
      const downloadChild = spawn('yt-dlp', downloadArgs, {
        stdio: ['ignore', 'pipe', 'pipe']
      })

      let downloadError = ''
      downloadChild.stderr.on('data', (data) => {
        downloadError += data.toString()
      })

      downloadChild.on('exit', (code) => {
        if (code === 0) {
          resolve()
        } else {
          reject(new Error(`Download failed: ${downloadError}`))
        }
      })
    })

    // Check if file exists
    try {
      await access(tempVideoPath)
    } catch {
      throw new Error('Downloaded video file not found')
    }

    console.log('Step 2: Clipping video with ffmpeg')

    // Step 2: Clip the video using ffmpeg
    const startSeconds = parseTimeToSeconds(startTime)
    const endSeconds = parseTimeToSeconds(endTime)

    const ffmpegArgs = ['-i', tempVideoPath]

    // Add timing parameters
    if (startSeconds !== null) {
      ffmpegArgs.push('-ss', startSeconds.toString())
    }

    if (endSeconds !== null && startSeconds !== null) {
      const duration = endSeconds - startSeconds
      ffmpegArgs.push('-t', duration.toString())
    } else if (endSeconds !== null) {
      ffmpegArgs.push('-t', endSeconds.toString())
    }

    // Add output parameters
    ffmpegArgs.push(
      '-c', 'copy', // Copy streams without re-encoding when possible
      '-avoid_negative_ts', 'make_zero',
      '-y', // Overwrite output file
      tempClipPath
    )

    console.log('ffmpeg command:', 'ffmpeg', ffmpegArgs.join(' '))

    // Execute ffmpeg
    await new Promise<void>((resolve, reject) => {
      const ffmpegChild = spawn('ffmpeg', ffmpegArgs, {
        stdio: ['ignore', 'pipe', 'pipe']
      })

      let ffmpegError = ''
      ffmpegChild.stderr.on('data', (data) => {
        ffmpegError += data.toString()
      })

      ffmpegChild.on('exit', (code) => {
        if (code === 0) {
          resolve()
        } else {
          reject(new Error(`ffmpeg failed: ${ffmpegError}`))
        }
      })
    })

    // Step 3: Read the clipped file and return it
    console.log('Step 3: Reading clipped file')
    const fs = require('fs').promises
    const clippedBuffer = await fs.readFile(tempClipPath)

    // Clean up temp files
    try {
      await unlink(tempVideoPath)
      await unlink(tempClipPath)
    } catch (cleanupError) {
      console.warn('Failed to clean up temp files:', cleanupError)
    }

    const isAudio = format?.includes('audio')
    const contentType = isAudio ? 'audio/mpeg' : 'video/mp4'
    const extension = isAudio ? 'mp3' : 'mp4'

    return new Response(clippedBuffer, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="clip.${extension}"`,
        'Content-Length': clippedBuffer.length.toString(),
        'X-Clipping-Status': 'server-side-clipped',
      },
    })

  } catch (error: any) {
    // Clean up temp files on error
    try {
      await unlink(tempVideoPath).catch(() => {})
      await unlink(tempClipPath).catch(() => {})
    } catch {}

    console.error('Clipping error:', error)

    // Check if it's an ffmpeg availability issue
    if (error.message.includes('ffmpeg')) {
      return Response.json({
        error: 'ffmpeg is required for video clipping but is not available on the server',
        details: 'Please install ffmpeg on your server or use the direct download option',
        suggestion: 'Install ffmpeg with: sudo apt install ffmpeg (Ubuntu/Debian) or brew install ffmpeg (macOS)'
      }, { status: 500 })
    }

    return Response.json({
      error: 'Video clipping failed',
      details: error.message
    }, { status: 500 })
  }
}