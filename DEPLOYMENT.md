# Deployment Guide

This document provides comprehensive deployment instructions and configuration for the Video Downloader application across different platforms.

## Environment Variables

### Core Configuration

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `DEPLOYMENT_PLATFORM` | Target deployment platform | `local` | Yes |
| `NODE_ENV` | Node.js environment | `development` | No |
| `PORT` | Server port | `3000` | No |

### Video Processing Configuration

| Variable | Description | Default | Vercel | Railway | Docker |
|----------|-------------|---------|--------|---------|--------|
| `MAX_FILE_SIZE` | Maximum file size in bytes | `50000000` | `100000000` | `500000000` | `1000000000` |
| `PROCESSING_TIMEOUT` | Processing timeout in ms | `30000` | `280000` | `600000` | `900000` |
| `MAX_VIDEO_DURATION` | Max video duration in seconds | `1800` | `1800` | `3600` | `7200` |
| `ENABLE_CLIPPING` | Enable video clipping feature | `true` | `true` | `true` | `true` |
| `ENABLE_AUDIO_EXTRACTION` | Enable audio extraction | `true` | `true` | `true` | `true` |
| `DEFAULT_VIDEO_QUALITY` | Default video quality | `720p` | `720p` | `1080p` | `1080p` |

### Platform-Specific Variables

#### Vercel
```bash
DEPLOYMENT_PLATFORM=vercel
MAX_FILE_SIZE=100000000
PROCESSING_TIMEOUT=280000
MAX_VIDEO_DURATION=1800
ENABLE_CLIPPING=true
ENABLE_AUDIO_EXTRACTION=true
DEFAULT_VIDEO_QUALITY=720p
```

#### Railway
```bash
DEPLOYMENT_PLATFORM=railway
MAX_FILE_SIZE=500000000
PROCESSING_TIMEOUT=600000
MAX_VIDEO_DURATION=3600
ENABLE_CLIPPING=true
ENABLE_AUDIO_EXTRACTION=true
DEFAULT_VIDEO_QUALITY=1080p
NODE_ENV=production
```

#### Docker/Local
```bash
DEPLOYMENT_PLATFORM=docker
MAX_FILE_SIZE=1000000000
PROCESSING_TIMEOUT=900000
MAX_VIDEO_DURATION=7200
ENABLE_CLIPPING=true
ENABLE_AUDIO_EXTRACTION=true
DEFAULT_VIDEO_QUALITY=1080p
NODE_ENV=production
```

## Platform-Specific Deployment Instructions

### Vercel Deployment

1. **Prerequisites**
   - Vercel CLI installed: `npm i -g vercel`
   - Vercel account connected

2. **Configuration**
   - Uses `yt-dlp-exec` and `ffmpeg-static` npm packages
   - Limited to 5-minute function execution time
   - Maximum 3GB memory allocation
   - Optimized for smaller file processing

3. **Deploy**
   ```bash
   vercel --prod
   ```

4. **Environment Variables**
   Set in Vercel dashboard or via CLI:
   ```bash
   vercel env add DEPLOYMENT_PLATFORM
   vercel env add MAX_FILE_SIZE
   vercel env add PROCESSING_TIMEOUT
   ```

### Railway Deployment

1. **Prerequisites**
   - Railway account
   - GitHub repository connected

2. **Configuration**
   - Uses system binaries (yt-dlp, ffmpeg)
   - Higher resource limits
   - Better for larger file processing

3. **Deploy**
   - Connect GitHub repository to Railway
   - Railway automatically detects `nixpacks.toml`
   - Environment variables set via Railway dashboard

4. **Health Check**
   - Endpoint: `/api/health`
   - Timeout: 30 seconds

### Docker Deployment

1. **Build Image**
   ```bash
   docker build -t video-downloader .
   ```

2. **Run Container**
   ```bash
   docker run -p 3000:3000 \
     -e DEPLOYMENT_PLATFORM=docker \
     -e MAX_FILE_SIZE=1000000000 \
     -e PROCESSING_TIMEOUT=900000 \
     video-downloader
   ```

3. **Docker Compose**
   ```yaml
   version: '3.8'
   services:
     video-downloader:
       build: .
       ports:
         - "3000:3000"
       environment:
         - DEPLOYMENT_PLATFORM=docker
         - MAX_FILE_SIZE=1000000000
         - PROCESSING_TIMEOUT=900000
         - MAX_VIDEO_DURATION=7200
   ```

## Configuration Files

### vercel.json
- Function-specific memory and timeout settings
- Environment variables for build and runtime
- Regional deployment configuration
- Optimized for serverless video processing

### railway.json
- Nixpacks builder configuration
- Health check settings
- Restart policy configuration
- Environment variable definitions

### nixpacks.toml
- System package dependencies (ffmpeg, python3, yt-dlp)
- Build and install phases
- Runtime environment variables
- Start command configuration

## Resource Limits by Platform

| Platform | Max Memory | Max Duration | Max File Size | Concurrent Requests |
|----------|------------|--------------|---------------|-------------------|
| Vercel | 3GB | 5 minutes | 100MB | 1000/min |
| Railway | 8GB | No limit | 500MB | Unlimited |
| Docker | System limit | No limit | 1GB | System limit |

## Monitoring and Health Checks

### Health Check Endpoint
- URL: `/api/health`
- Returns platform information and dependency status
- Use for monitoring deployment health

### Example Response
```json
{
  "status": "healthy",
  "platform": "vercel",
  "dependencies": {
    "ytdlp": "package",
    "ffmpeg": "package"
  },
  "limits": {
    "maxFileSize": 100000000,
    "maxDuration": 1800,
    "timeout": 280000
  }
}
```

## Security Considerations

1. **Input Validation**
   - All URLs are validated before processing
   - File size limits enforced
   - Duration limits enforced

2. **Resource Protection**
   - Timeout configurations prevent hanging processes
   - Memory limits prevent resource exhaustion
   - Rate limiting recommended for production

3. **Environment Variables**
   - Never commit sensitive variables to version control
   - Use platform-specific secret management
   - Rotate secrets regularly

## Performance Optimization

1. **Vercel Optimizations**
   - Use edge regions closest to users
   - Implement caching for video metadata
   - Optimize bundle size

2. **Railway Optimizations**
   - Use persistent storage for temporary files
   - Implement connection pooling
   - Monitor resource usage

3. **General Optimizations**
   - Stream large files instead of loading into memory
   - Implement progress indicators for long operations
   - Use appropriate video quality defaults