# Deployment Troubleshooting Guide

This guide helps diagnose and resolve common deployment issues across different platforms.

## Quick Diagnosis

### Health Check

First, check the health endpoint to understand your deployment status:

```bash
curl https://your-app.vercel.app/api/health
```

### Common Error Patterns

- **Binary not found**: System dependencies missing
- **Timeout errors**: Processing limits exceeded
- **Memory errors**: Resource limits exceeded
- **Package errors**: npm package installation issues

## Platform-Specific Issues

### Vercel Issues

#### Issue: "yt-dlp command not found"

**Symptoms:**

- API returns 500 errors
- Logs show "spawn yt-dlp ENOENT"

**Cause:** Application trying to use system binary instead of npm package

**Solution:**

1. Check `next.config.js` has proper externals configuration:

```javascript
module.exports = {
  experimental: {
    serverComponentsExternalPackages: ["yt-dlp-exec", "ffmpeg-static"],
  },
};
```

2. Verify `package.json` includes packages:

```json
{
  "dependencies": {
    "yt-dlp-exec": "^1.0.2",
    "ffmpeg-static": "^5.2.0"
  }
}
```

3. Check platform detection in code:

```typescript
// Should detect 'vercel' platform and use packages
const platform = process.env.DEPLOYMENT_PLATFORM || "local";
```

#### Issue: Function timeout on Vercel

**Symptoms:**

- Requests timeout after 10-30 seconds
- Large video downloads fail

**Cause:** Default function timeout too low for video processing

**Solution:**

1. Update `vercel.json` with higher limits:

```json
{
  "functions": {
    "app/api/download/route.ts": {
      "maxDuration": 300,
      "memory": 3008
    }
  }
}
```

2. Optimize processing for smaller files:

```typescript
// Check file size before processing
if (fileSize > MAX_FILE_SIZE) {
  throw new Error("File too large for Vercel processing");
}
```

#### Issue: Memory limit exceeded

**Symptoms:**

- "Runtime exited with error: signal: killed"
- Out of memory errors in logs

**Cause:** Video processing exceeds memory limits

**Solution:**

1. Increase memory in `vercel.json`:

```json
{
  "functions": {
    "app/api/download/route.ts": {
      "memory": 3008
    }
  }
}
```

2. Implement streaming for large files:

```typescript
// Stream instead of loading entire file
const stream = ytdlp.exec(url, { format: "best[filesize<100M]" });
```

### Railway Issues

#### Issue: "yt-dlp not found" on Railway

**Symptoms:**

- Health check shows ytdlp: 'none'
- Download API fails with binary errors

**Cause:** yt-dlp not installed during build

**Solution:**

1. Check `nixpacks.toml` configuration:

```toml
[phases.setup]
nixPkgs = ["python3", "python3Packages.pip", "ffmpeg"]

[phases.install]
cmds = [
  "pip3 install --upgrade yt-dlp"
]
```

2. Verify build logs show successful yt-dlp installation

3. Test in Railway shell:

```bash
railway shell
yt-dlp --version
ffmpeg -version
```

#### Issue: Build fails on Railway

**Symptoms:**

- Deployment fails during build phase
- npm install errors

**Cause:** Missing system dependencies or npm cache issues

**Solution:**

1. Clear Railway build cache:

```bash
railway up --detach
```

2. Check nixpacks configuration includes Node.js:

```toml
[phases.setup]
nixPkgs = ["nodejs", "python3", "python3Packages.pip", "ffmpeg"]
```

3. Verify package.json engines:

```json
{
  "engines": {
    "node": ">=18.0.0"
  }
}
```

#### Issue: Railway app crashes on startup

**Symptoms:**

- App starts but immediately crashes
- Health check fails

**Cause:** Missing environment variables or port configuration

**Solution:**

1. Set required environment variables in Railway dashboard:

```
DEPLOYMENT_PLATFORM=railway
PORT=3000
NODE_ENV=production
```

2. Check start command in `nixpacks.toml`:

```toml
[start]
cmd = "npm start"
```

### Docker Issues

#### Issue: Docker build fails

**Symptoms:**

- "Package not found" during docker build
- ffmpeg installation errors

**Cause:** Missing system packages in Dockerfile

**Solution:**

1. Update Dockerfile with required packages:

```dockerfile
FROM node:18-alpine

# Install system dependencies
RUN apk add --no-cache \
    python3 \
    py3-pip \
    ffmpeg

# Install yt-dlp
RUN pip3 install yt-dlp

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

EXPOSE 3000
CMD ["npm", "start"]
```

#### Issue: Container runs but APIs fail

**Symptoms:**

- Container starts successfully
- Health check shows missing dependencies

**Cause:** Dependencies installed but not in PATH

**Solution:**

1. Verify PATH includes binary locations:

```dockerfile
ENV PATH="/usr/local/bin:$PATH"
```

2. Test dependencies in running container:

```bash
docker exec -it container-name sh
which yt-dlp
which ffmpeg
```

## Dependency Issues

### yt-dlp Issues

#### Issue: yt-dlp version conflicts

**Symptoms:**

- Video extraction fails for certain sites
- Format errors

**Solution:**

1. Update to latest version:

```bash
# For system installation
pip3 install --upgrade yt-dlp

# For npm package
npm update yt-dlp-exec
```

2. Check supported extractors:

```bash
yt-dlp --list-extractors | grep youtube
```

#### Issue: yt-dlp rate limiting

**Symptoms:**

- "Too many requests" errors
- Temporary download failures

**Solution:**

1. Implement retry logic with backoff:

```typescript
const downloadWithRetry = async (url: string, retries = 3) => {
  for (let i = 0; i < retries; i++) {
    try {
      return await ytdlp.exec(url);
    } catch (error) {
      if (i === retries - 1) throw error;
      await new Promise((resolve) => setTimeout(resolve, 1000 * (i + 1)));
    }
  }
};
```

2. Add user agent rotation:

```typescript
const userAgents = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
];

ytdlp.exec(url, {
  userAgent: userAgents[Math.floor(Math.random() * userAgents.length)],
});
```

### FFmpeg Issues

#### Issue: FFmpeg codec errors

**Symptoms:**

- Video processing fails
- "Codec not supported" errors

**Solution:**

1. Check available codecs:

```bash
ffmpeg -codecs | grep h264
```

2. Use compatible formats:

```typescript
const ffmpegArgs = [
  "-c:v",
  "libx264", // Use compatible video codec
  "-c:a",
  "aac", // Use compatible audio codec
  "-preset",
  "fast", // Optimize for speed
];
```

#### Issue: FFmpeg memory usage

**Symptoms:**

- Processing fails on large videos
- Out of memory errors

**Solution:**

1. Limit memory usage:

```typescript
const ffmpegArgs = [
  "-threads",
  "2", // Limit CPU threads
  "-preset",
  "ultrafast", // Fastest encoding
  "-crf",
  "28", // Reduce quality for smaller size
];
```

2. Process in chunks for large files:

```typescript
// Split large videos into segments
const segmentDuration = 300; // 5 minutes
ffmpeg
  .input(inputFile)
  .outputOptions(["-f", "segment", "-segment_time", segmentDuration])
  .output("output_%03d.mp4");
```

## Network and Performance Issues

### Slow Download Speeds

**Symptoms:**

- Downloads take very long
- Timeouts on large files

**Solutions:**

1. Optimize yt-dlp format selection:

```typescript
const format = "best[filesize<100M]/best[height<=720]";
ytdlp.exec(url, { format });
```

2. Implement parallel downloads:

```typescript
const downloadSegments = async (url: string) => {
  const info = await ytdlp.getInfo(url);
  const segments = info.fragments || [];

  const downloads = segments.map((segment) => downloadSegment(segment.url));

  return Promise.all(downloads);
};
```

### High Memory Usage

**Symptoms:**

- Memory usage grows during processing
- Application becomes unresponsive

**Solutions:**

1. Implement streaming:

```typescript
import { pipeline } from "stream/promises";

const processVideo = async (inputStream, outputStream) => {
  await pipeline(inputStream, ffmpeg().format("mp4"), outputStream);
};
```

2. Clean up temporary files:

```typescript
const cleanup = () => {
  fs.readdirSync("/tmp")
    .filter((file) => file.startsWith("video-"))
    .forEach((file) => fs.unlinkSync(path.join("/tmp", file)));
};

process.on("exit", cleanup);
process.on("SIGINT", cleanup);
```

## Debugging Tools

### Enable Debug Logging

```typescript
// Add to environment variables
(DEBUG = yt - dlp - exec), ffmpeg - static;

// Or in code
process.env.DEBUG = "yt-dlp-exec,ffmpeg-static";
```

### Health Check Debugging

```bash
# Check all endpoints
curl -v https://your-app.com/api/health
curl -v https://your-app.com/api/video-info?url=test
```

### Log Analysis

```typescript
// Add detailed logging
console.log("Platform:", process.env.DEPLOYMENT_PLATFORM);
console.log("Available tools:", await dependencyChecker.getAvailableTools());
console.log("Memory usage:", process.memoryUsage());
```

## Getting Help

### Information to Collect

When reporting issues, include:

1. Platform (Vercel, Railway, Docker, Local)
2. Error messages and stack traces
3. Health check response
4. Environment variables (without sensitive data)
5. Video URL that's failing (if safe to share)

### Useful Commands

```bash
# Check deployment status
vercel logs --follow
railway logs --follow

# Test locally
npm run dev
curl http://localhost:3000/api/health

# Check dependencies
npm list yt-dlp-exec ffmpeg-static
which yt-dlp ffmpeg
```

### Support Resources

- [Vercel Documentation](https://vercel.com/docs)
- [Railway Documentation](https://docs.railway.app)
- [yt-dlp Documentation](https://github.com/yt-dlp/yt-dlp)
- [FFmpeg Documentation](https://ffmpeg.org/documentation.html)
