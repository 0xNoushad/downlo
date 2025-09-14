# Video Downloader

A Next.js-based universal video downloader that supports multiple platforms including YouTube, TikTok, Instagram, Twitter, Facebook, Vimeo, and more.

## 🎬 Demo

See the app in action:

https://github.com/user-attachments/assets/3c9d4943-06b8-4f04-ae3c-1d474f6b096e

_Watch how easy it is to download videos from any supported platform with just a URL paste!_

### ✨ Key Features Shown

- **Instant URL detection** - Just paste and go
- **Video preview** - See thumbnail and details before downloading
- **Multiple formats** - Choose quality and format
- **Smart clipping** - Download specific segments

---

## 🏗️ Architecture Overview

This application uses a **server-side processing architecture** with Next.js API routes to handle video downloads securely without exposing sensitive operations to the client.

### Core Components

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Frontend      │    │   API Routes     │    │   External      │
│   (React)       │◄──►│   (Next.js)      │◄──►│   Tools         │
│                 │    │                  │    │                 │
│ • URL Input     │    │ • video-info     │    │ • yt-dlp        │
│ • Video Preview │    │ • download       │    │ • ffmpeg        │
│ • Format Select │    │ • thumbnail      │    │                 │
│ • Clip Settings │    │ • ffmpeg-check   │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

## 🛠️ Technical Stack

### Frontend

- **Next.js 14** - React framework with App Router
- **TypeScript** - Type safety and better DX
- **Tailwind CSS** - Utility-first styling
- **Shadcn/UI** - Component library
- **Lucide React** - Icon library

### Backend

- **Next.js API Routes** - Server-side processing
- **Node.js Child Process** - External tool execution
- **Stream Processing** - Memory-efficient file handling

### External Dependencies

- **yt-dlp** - Video extraction engine
- **ffmpeg** - Video processing and clipping

## 📁 API Routes Architecture

### `/api/video-info` - Video Metadata Extraction

**Purpose**: Extracts video metadata without downloading the actual video file.

**Process Flow**:

```bash
1. Client sends URL → API Route
2. API validates URL format
3. Executes: yt-dlp --dump-single-json [URL]
4. Parses JSON response
5. Returns formatted metadata
```

**Key Features**:

- Platform detection (YouTube, TikTok, etc.)
- Thumbnail extraction
- Duration formatting
- File size estimation
- Format availability check

**Command Example**:

```bash
yt-dlp "https://youtube.com/watch?v=example" \
  --dump-single-json \
  --no-check-certificates \
  --no-warnings \
  --format best \
  --geo-bypass
```

### `/api/download` - Video Download Engine

**Purpose**: Downloads videos with optional clipping functionality.

**Two Processing Modes**:

#### 1. Direct Download (No Clipping)

```bash
yt-dlp -f [format] --no-warnings -o - [URL]
```

- Streams directly to client
- Memory efficient
- Fastest option

#### 2. Clipped Download (Server-side Processing)

```bash
# Step 1: Download to temp file
yt-dlp -f [format] -o /tmp/video.mp4 [URL]

# Step 2: Clip with ffmpeg
ffmpeg -i /tmp/video.mp4 -ss [start] -t [duration] -c copy /tmp/clip.mp4

# Step 3: Stream clipped file to client
```

**Clipping Logic**:

- Time parsing: `mm:ss` or `hh:mm:ss` → seconds
- Smart codec copying (no re-encoding when possible)
- Temporary file management
- Automatic cleanup

### `/api/thumbnail` - Thumbnail Management

**Purpose**: Extracts and serves video thumbnails in multiple qualities.

**Features**:

- Multiple thumbnail qualities (maxres, high, medium, default)
- CORS proxy for thumbnail downloads
- Quality selection algorithm
- Fallback thumbnail generation

**Process**:

```bash
# Extract thumbnail list
yt-dlp --list-thumbnails [URL]

# Parse available qualities
# Select best quality based on preference
# Proxy download to avoid CORS issues
```

### `/api/ffmpeg` - System Check

**Purpose**: Verifies ffmpeg availability for clipping functionality.

```bash
ffmpeg -version  # Check if available
```

## 🔧 Installation & Setup

### Prerequisites

1. **Node.js** (v18 or higher)
2. **Python** (v3.7 or higher)
3. **yt-dlp** - Video extraction tool
4. **ffmpeg** - Video processing (optional, for clipping)

### Step 1: Install Node.js Dependencies

```bash
npm install
# or
yarn install
# or
pnpm install
```

### Step 2: Install yt-dlp

**Option A: Using pip (Recommended)**

```bash
pip install yt-dlp
```

**Option B: Using pipx (Isolated)**

```bash
pipx install yt-dlp
```

**Option C: Direct download**

```bash
# Linux/macOS
sudo curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp
sudo chmod a+rx /usr/local/bin/yt-dlp

# Windows (PowerShell)
Invoke-WebRequest -Uri https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe -OutFile yt-dlp.exe
```

### Step 3: Install ffmpeg (Optional - for clipping)

**Ubuntu/Debian:**

```bash
sudo apt update
sudo apt install ffmpeg
```

**macOS:**

```bash
brew install ffmpeg
```

**Windows:**

```bash
# Using Chocolatey
choco install ffmpeg

# Using Scoop
scoop install ffmpeg
```

**CentOS/RHEL:**

```bash
sudo yum install epel-release
sudo yum install ffmpeg
```

### Step 4: Verify Installation

```bash
# Check yt-dlp
yt-dlp --version

# Check ffmpeg (optional)
ffmpeg -version

# Check Node.js
node --version
```

### Step 5: Run the Application

```bash
# Development
npm run dev

# Production
npm run build
npm start
```

## 🔍 How It Works

### 1. Video Information Extraction

When a user pastes a URL:

```typescript
// Client sends URL to /api/video-info
const response = await fetch("/api/video-info", {
  method: "POST",
  body: JSON.stringify({ url }),
});

// Server executes yt-dlp
const command = `yt-dlp "${url}" --dump-single-json --no-warnings`;
const { stdout } = await execAsync(command);
const info = JSON.parse(stdout);

// Returns formatted metadata
return {
  thumbnail: info.thumbnail,
  title: info.title,
  duration: formatDuration(info.duration),
  platform: detectPlatform(url),
  formats: info.formats,
};
```

### 2. Video Download Process

#### Direct Download Flow:

```typescript
// Spawn yt-dlp process
const child = spawn("yt-dlp", [
  "-f",
  format,
  "--no-warnings",
  "-o",
  "-", // Output to stdout
  url,
]);

// Stream directly to client
child.stdout.on("data", (chunk) => {
  // Forward chunk to HTTP response
});
```

#### Clipped Download Flow:

```typescript
// Step 1: Download full video
await downloadToTemp(url, format, tempPath);

// Step 2: Process with ffmpeg
const ffmpegArgs = [
  "-i",
  tempPath,
  "-ss",
  startTime,
  "-t",
  duration,
  "-c",
  "copy", // No re-encoding
  outputPath,
];
await execFFmpeg(ffmpegArgs);

// Step 3: Stream processed file
const buffer = await readFile(outputPath);
return new Response(buffer);
```

### 3. Platform Support

The application supports these platforms through yt-dlp:

| Platform   | URL Pattern               | Special Features                 |
| ---------- | ------------------------- | -------------------------------- |
| YouTube    | `youtube.com`, `youtu.be` | Multiple qualities, live streams |
| TikTok     | `tiktok.com`              | Mobile optimized                 |
| Instagram  | `instagram.com`           | Stories, reels, posts            |
| Twitter    | `twitter.com`, `x.com`    | Video tweets                     |
| Facebook   | `facebook.com`            | Public videos                    |
| Vimeo      | `vimeo.com`               | High quality options             |
| Twitch     | `twitch.tv`               | Clips and VODs                   |
| Reddit     | `reddit.com`              | Video posts                      |
| SoundCloud | `soundcloud.com`          | Audio extraction                 |

### 4. Error Handling

The application implements comprehensive error handling:

```typescript
// Platform-specific errors
if (error.includes("Private video")) {
  return "This video is private and cannot be downloaded";
}
if (error.includes("geo-blocked")) {
  return "Content is geo-blocked or restricted";
}

// System errors
if (error.code === "ENOENT") {
  return "yt-dlp not found in PATH";
}
```

## 🚀 Deployment Considerations

### Environment Requirements

1. **Server Environment**: Linux/macOS/Windows with Node.js
2. **Python Environment**: Python 3.7+ with pip
3. **System Tools**: yt-dlp and optionally ffmpeg in PATH
4. **Memory**: Sufficient for temporary file storage during clipping
5. **Disk Space**: Temporary storage for video processing

### Docker Deployment

```dockerfile
FROM node:18-alpine

# Install Python and pip
RUN apk add --no-cache python3 py3-pip ffmpeg

# Install yt-dlp
RUN pip3 install yt-dlp

# Copy and install app
COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

EXPOSE 3000
CMD ["npm", "start"]
```

### Performance Optimization

1. **Streaming**: Direct streaming for non-clipped downloads
2. **Temporary Files**: Automatic cleanup of processed files
3. **Memory Management**: Buffer size limits for large files
4. **Timeout Handling**: Request timeouts for slow platforms
5. **Concurrent Limits**: Process spawning limits

## 🔒 Security Considerations

1. **Input Validation**: URL format validation
2. **Command Injection**: Proper argument escaping
3. **File System**: Temporary file isolation
4. **Resource Limits**: Memory and timeout constraints
5. **User Agent**: Proper headers to avoid blocking

## 🐛 Troubleshooting

### Common Issues

**1. "yt-dlp not found"**

```bash
# Check if yt-dlp is in PATH
which yt-dlp
yt-dlp --version

# Install if missing
pip install yt-dlp
```

**2. "ffmpeg not available"**

```bash
# Check ffmpeg installation
which ffmpeg
ffmpeg -version

# Install if missing (Ubuntu)
sudo apt install ffmpeg
```

**3. "Download failed"**

- Check internet connectivity
- Verify URL is accessible
- Check if video is private/geo-blocked
- Update yt-dlp: `pip install -U yt-dlp`

**4. "Clipping not working"**

- Ensure ffmpeg is installed
- Check temporary directory permissions
- Verify sufficient disk space

### Debug Mode

Enable detailed logging:

```bash
# Set environment variable
DEBUG=1 npm run dev

# Check API logs in browser network tab
# Check server logs in terminal
```

## 📊 Performance Metrics

- **Direct Download**: ~5-10MB/s (network dependent)
- **Clipped Download**: ~2-5MB/s (processing overhead)
- **Memory Usage**: ~50-200MB per concurrent download
- **Disk Usage**: Temporary files during clipping only

## 🔄 Updates & Maintenance

### Keeping yt-dlp Updated

```bash
# Update yt-dlp regularly for platform compatibility
pip install -U yt-dlp
```

### Platform Changes

- Monitor yt-dlp releases for platform fixes
- Test major platforms regularly
- Update error handling for new edge cases

---

## 📝 License

This project is for educational purposes. Respect platform terms of service and copyright laws when downloading content.
