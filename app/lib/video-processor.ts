import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import { unlink, access } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { dependencyChecker, type ToolAvailability } from './dependency-checker';

const execAsync = promisify(exec);

export interface VideoInfo {
  thumbnail: string;
  title: string;
  duration: string;
  platform: string;
  fileSize: string;
  formats: VideoFormat[];
  uploader?: string;
  uploadDate?: string;
  viewCount?: string;
  likeCount?: string;
}

export interface VideoFormat {
  id: string;
  ext: string;
  quality: string;
  filesize?: number;
}

export interface DownloadOptions {
  format?: string;
  startTime?: string;
  endTime?: string;
}

export interface ProcessingOptions {
  startTime?: number;
  endTime?: number;
  outputFormat?: string;
}

export interface ThumbnailInfo {
  url: string;
  width: string;
  height: string;
  quality: string;
}

export interface ThumbnailOptions {
  quality?: 'best' | 'high' | 'medium' | 'default';
}

export interface VideoProcessor {
  getVideoInfo(url: string): Promise<VideoInfo>;
  downloadVideo(url: string, options?: DownloadOptions): Promise<Buffer>;
  processVideo(inputPath: string, options: ProcessingOptions): Promise<Buffer>;
  getThumbnails(url: string, options?: ThumbnailOptions): Promise<ThumbnailInfo[]>;
  isAvailable(): Promise<boolean>;
}

/**
 * Vercel-compatible video processor using npm packages
 */
export class VercelVideoProcessor implements VideoProcessor {
  private ytDlpExec: any = null;
  private ffmpegPath: string = '';

  constructor() {
    this.initializePackages();
  }

  private async initializePackages(): Promise<void> {
    try {
      // Dynamically import yt-dlp-exec
      const ytDlpModule = await import('yt-dlp-exec');
      this.ytDlpExec = ytDlpModule.default;

      // Get ffmpeg path from ffmpeg-static
      const ffmpegStatic = await import('ffmpeg-static');
      this.ffmpegPath = ffmpegStatic.default || '';
    } catch (error) {
      console.warn('Failed to initialize Vercel packages:', error);
    }
  }

  async isAvailable(): Promise<boolean> {
    const tools = await dependencyChecker.getAvailableTools();
    return tools.ytdlp === 'package' && tools.ffmpeg === 'package';
  }

  async getVideoInfo(url: string): Promise<VideoInfo> {
    if (!this.ytDlpExec) {
      await this.initializePackages();
    }

    if (!this.ytDlpExec) {
      throw new Error('yt-dlp-exec package not available');
    }

    try {
      const info = await this.ytDlpExec(url, {
        dumpSingleJson: true,
        noCheckCertificates: true,
        noWarnings: true,
        format: 'best',
        preferFreeFormats: true,
        geoBypass: true,
        ignoreErrors: true,
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      });

      return this.formatVideoInfo(info, url);
    } catch (error: any) {
      throw new Error(`Failed to get video info: ${error.message}`);
    }
  }

  async downloadVideo(url: string, options: DownloadOptions = {}): Promise<Buffer> {
    if (!this.ytDlpExec) {
      await this.initializePackages();
    }

    if (!this.ytDlpExec) {
      throw new Error('yt-dlp-exec package not available');
    }

    const needsClipping = !!(options.startTime || options.endTime);

    if (needsClipping) {
      return this.downloadAndClip(url, options);
    } else {
      return this.directDownload(url, options);
    }
  }

  private async directDownload(url: string, options: DownloadOptions): Promise<Buffer> {
    try {
      const buffer = await this.ytDlpExec(url, {
        format: options.format || 'best',
        noWarnings: true,
        noCheckCertificate: true,
        noPlaylist: true,
        ignoreErrors: true,
        geoBypass: true,
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        output: '-'
      });

      return Buffer.from(buffer);
    } catch (error: any) {
      throw new Error(`Download failed: ${error.message}`);
    }
  }

  private async downloadAndClip(url: string, options: DownloadOptions): Promise<Buffer> {
    const tempDir = tmpdir();
    const tempVideoPath = join(tempDir, `temp_video_${Date.now()}.mp4`);
    const tempClipPath = join(tempDir, `temp_clip_${Date.now()}.mp4`);

    try {
      // Step 1: Download to temp file
      await this.ytDlpExec(url, {
        format: options.format || 'best',
        noWarnings: true,
        noCheckCertificate: true,
        noPlaylist: true,
        ignoreErrors: true,
        geoBypass: true,
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        output: tempVideoPath
      });

      // Step 2: Process with ffmpeg
      const processingOptions: ProcessingOptions = {
        startTime: this.parseTimeToSeconds(options.startTime || ''),
        endTime: this.parseTimeToSeconds(options.endTime || ''),
      };

      const clippedBuffer = await this.processVideo(tempVideoPath, processingOptions);

      // Cleanup
      try {
        await unlink(tempVideoPath);
      } catch (cleanupError) {
        console.warn('Failed to clean up temp file:', cleanupError);
      }

      return clippedBuffer;
    } catch (error: any) {
      // Cleanup on error
      try {
        await unlink(tempVideoPath).catch(() => {});
        await unlink(tempClipPath).catch(() => {});
      } catch {}

      throw new Error(`Clipped download failed: ${error.message}`);
    }
  }

  async processVideo(inputPath: string, options: ProcessingOptions): Promise<Buffer> {
    if (!this.ffmpegPath) {
      throw new Error('ffmpeg-static package not available');
    }

    const tempDir = tmpdir();
    const outputPath = join(tempDir, `processed_${Date.now()}.mp4`);

    try {
      const args = ['-i', inputPath];

      if (options.startTime !== null && options.startTime !== undefined) {
        args.push('-ss', options.startTime.toString());
      }

      if (options.endTime !== null && options.endTime !== undefined && 
          options.startTime !== null && options.startTime !== undefined) {
        const duration = options.endTime - options.startTime;
        args.push('-t', duration.toString());
      } else if (options.endTime !== null && options.endTime !== undefined) {
        args.push('-t', options.endTime.toString());
      }

      args.push(
        '-c', 'copy',
        '-avoid_negative_ts', 'make_zero',
        '-y',
        outputPath
      );

      await new Promise<void>((resolve, reject) => {
        const ffmpegProcess = spawn(this.ffmpegPath, args, {
          stdio: ['ignore', 'pipe', 'pipe']
        });

        let errorOutput = '';
        ffmpegProcess.stderr.on('data', (data) => {
          errorOutput += data.toString();
        });

        ffmpegProcess.on('exit', (code) => {
          if (code === 0) {
            resolve();
          } else {
            reject(new Error(`ffmpeg failed: ${errorOutput}`));
          }
        });
      });

      // Read processed file
      const fs = require('fs').promises;
      const processedBuffer = await fs.readFile(outputPath);

      // Cleanup
      try {
        await unlink(outputPath);
      } catch (cleanupError) {
        console.warn('Failed to clean up processed file:', cleanupError);
      }

      return processedBuffer;
    } catch (error: any) {
      // Cleanup on error
      try {
        await unlink(outputPath).catch(() => {});
      } catch {}

      throw new Error(`Video processing failed: ${error.message}`);
    }
  }

  private formatVideoInfo(info: any, url: string): VideoInfo {
    const platform = this.detectPlatform(url, info.extractor);
    const bestFormat = info.formats?.find((f: any) => 
      f.format_id === 'best' || f.quality === 'best'
    ) || info.formats?.[0];
    
    const estimatedSize = bestFormat?.filesize ? 
      this.formatFileSize(bestFormat.filesize) : 
      this.estimateSizeFromDuration(info.duration);

    return {
      thumbnail: info.thumbnail || info.thumbnails?.[0]?.url || this.generateDefaultThumbnail(platform),
      title: info.title || 'Untitled Video',
      duration: this.formatDuration(info.duration),
      platform: platform,
      fileSize: estimatedSize,
      formats: info.formats?.slice(0, 15).map((f: any) => ({
        id: f.format_id,
        ext: f.ext,
        quality: f.format_note || f.height || f.resolution || f.quality || 'unknown',
        filesize: f.filesize,
      })) || [],
      uploader: info.uploader || info.channel || 'Unknown',
      uploadDate: info.upload_date ? this.formatUploadDate(info.upload_date) : undefined,
      viewCount: info.view_count ? this.formatViewCount(info.view_count) : undefined,
      likeCount: info.like_count ? this.formatNumber(info.like_count) : undefined,
    };
  }

  private parseTimeToSeconds(timeStr: string): number | undefined {
    if (!timeStr) return undefined;
    
    const parts = timeStr.split(':').map(Number);
    if (parts.some(isNaN)) return undefined;
    
    if (parts.length === 2) {
      return parts[0] * 60 + parts[1];
    } else if (parts.length === 3) {
      return parts[0] * 3600 + parts[1] * 60 + parts[2];
    }
    return undefined;
  }

  private detectPlatform(url: string, extractor?: string): string {
    const platformMap: Record<string, string> = {
      'youtube': 'YouTube',
      'vimeo': 'Vimeo',
      'dailymotion': 'Dailymotion',
      'instagram': 'Instagram',
      'pinterest': 'Pinterest',
      'tiktok': 'TikTok',
      'twitter/x': 'Twitter/X',
      'facebook': 'Facebook',
      'twitch': 'Twitch',
      'reddit': 'Reddit',
      'soundcloud': 'SoundCloud',
    };

    if (extractor) {
      const extractorLower = extractor.toLowerCase();
      for (const [key, value] of Object.entries(platformMap)) {
        if (extractorLower.includes(key)) {
          return value;
        }
      }
    }

    const urlLower = url.toLowerCase();
    for (const [key, value] of Object.entries(platformMap)) {
      if (urlLower.includes(key)) {
        return value;
      }
    }

    return '🌐 Unknown Platform';
  }

  private formatDuration(seconds: number): string {
    if (!seconds || seconds <= 0) return '0:00';
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    
    return hours > 0
      ? `${hours}:${this.padZero(minutes)}:${this.padZero(remainingSeconds)}`
      : `${minutes}:${this.padZero(remainingSeconds)}`;
  }

  private padZero(num: number): string {
    return num.toString().padStart(2, '0');
  }

  private formatFileSize(bytes: number): string {
    if (!bytes) return 'Unknown size';
    
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    
    return Math.round((bytes / Math.pow(1024, i)) * 100) / 100 + ' ' + sizes[i];
  }

  private estimateSizeFromDuration(duration: number): string {
    if (!duration) return 'Unknown size';
    
    const estimatedMB = Math.round(duration / 60);
    return `~${estimatedMB} MB`;
  }

  private generateDefaultThumbnail(platform: string): string {
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
    return `data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180" viewBox="0 0 320 180"><rect width="320" height="180" fill="%23f3f4f6"/><text x="160" y="90" font-family="Arial, sans-serif" font-size="60" text-anchor="middle" dy="0.35em">${emoji}</text></svg>`;
  }

  private formatUploadDate(dateStr: string): string {
    if (!dateStr) return '';
    
    const year = dateStr.substring(0, 4);
    const month = dateStr.substring(4, 6);
    const day = dateStr.substring(6, 8);
    
    try {
      const date = new Date(`${year}-${month}-${day}`);
      return date.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
      });
    } catch {
      return dateStr;
    }
  }

  private formatViewCount(count: number): string {
    if (count < 1000) return count.toString();
    if (count < 1000000) return Math.round(count / 1000) + 'K';
    if (count < 1000000000) return Math.round(count / 1000000) + 'M';
    return Math.round(count / 1000000000) + 'B';
  }

  private formatNumber(num: number): string {
    if (num < 1000) return num.toString();
    if (num < 1000000) return Math.round(num / 1000) + 'K';
    return Math.round(num / 1000000) + 'M';
  }

  async getThumbnails(url: string, options: ThumbnailOptions = {}): Promise<ThumbnailInfo[]> {
    if (!this.ytDlpExec) {
      await this.initializePackages();
    }

    if (!this.ytDlpExec) {
      throw new Error('yt-dlp-exec package not available');
    }

    try {
      // Get video info which includes thumbnail information
      const info = await this.ytDlpExec(url, {
        dumpSingleJson: true,
        noCheckCertificates: true,
        noWarnings: true,
        geoBypass: true,
        ignoreErrors: true,
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      });

      const thumbnails = this.extractThumbnailsFromInfo(info);
      
      if (thumbnails.length === 0) {
        // Fallback: create a default thumbnail
        const platform = this.detectPlatform(url, info.extractor);
        return [{
          url: this.generateDefaultThumbnail(platform),
          width: '320',
          height: '180',
          quality: 'default'
        }];
      }

      return thumbnails;
    } catch (error: any) {
      console.error('Failed to get thumbnails with yt-dlp-exec:', error);
      
      // Fallback: generate a default thumbnail
      const platform = this.detectPlatform(url);
      return [{
        url: this.generateDefaultThumbnail(platform),
        width: '320',
        height: '180',
        quality: 'default'
      }];
    }
  }

  private extractThumbnailsFromInfo(info: any): ThumbnailInfo[] {
    const thumbnails: ThumbnailInfo[] = [];
    
    if (info.thumbnails && Array.isArray(info.thumbnails)) {
      for (const thumb of info.thumbnails) {
        if (thumb.url) {
          thumbnails.push({
            url: thumb.url,
            width: thumb.width?.toString() || 'unknown',
            height: thumb.height?.toString() || 'unknown',
            quality: this.determineThumbnailQuality(thumb)
          });
        }
      }
    }

    // If no thumbnails array but has single thumbnail
    if (thumbnails.length === 0 && info.thumbnail) {
      thumbnails.push({
        url: info.thumbnail,
        width: 'unknown',
        height: 'unknown',
        quality: 'default'
      });
    }

    return thumbnails;
  }

  private determineThumbnailQuality(thumb: any): string {
    if (thumb.id) {
      const id = thumb.id.toLowerCase();
      if (id.includes('maxres')) return 'maxres';
      if (id.includes('hq') || id.includes('high')) return 'high';
      if (id.includes('mq') || id.includes('medium')) return 'medium';
    }

    if (thumb.width && thumb.height) {
      const pixels = thumb.width * thumb.height;
      if (pixels > 900000) return 'maxres';
      if (pixels > 200000) return 'high';
      if (pixels > 50000) return 'medium';
    }

    return 'default';
  }
}
/**
 
* System-based video processor using binary executables
 */
export class SystemVideoProcessor implements VideoProcessor {
  async isAvailable(): Promise<boolean> {
    const tools = await dependencyChecker.getAvailableTools();
    return tools.ytdlp === 'binary' && tools.ffmpeg === 'binary';
  }

  async getVideoInfo(url: string): Promise<VideoInfo> {
    // Check if yt-dlp is available
    try {
      const { stdout } = await execAsync('yt-dlp --version');
      console.log('yt-dlp version:', stdout.trim());
    } catch (error) {
      throw new Error('yt-dlp is not installed or not in PATH. Please install it using: pip install yt-dlp');
    }

    const command = `yt-dlp "${url}" --dump-single-json --no-check-certificates --no-warnings --format best --prefer-free-formats --geo-bypass --ignore-errors --user-agent "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"`;
    
    try {
      const { stdout, stderr } = await execAsync(command, { 
        timeout: 45000,
        maxBuffer: 1024 * 1024 * 20
      });

      if (stderr) {
        console.warn('yt-dlp warnings:', stderr);
      }

      const info = JSON.parse(stdout);
      return this.formatVideoInfo(info, url);
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        throw new Error('yt-dlp not found in PATH. Please install yt-dlp: pip install yt-dlp');
      }

      let userFriendlyError = 'Failed to fetch video information';
      if (error.message?.includes('Private video')) {
        userFriendlyError = 'This video is private and cannot be downloaded';
      } else if (error.message?.includes('Video unavailable')) {
        userFriendlyError = 'Video is unavailable or has been removed';
      } else if (error.message?.includes('Unsupported URL')) {
        userFriendlyError = 'This platform or URL format is not supported';
      } else if (error.message?.includes('Sign in to confirm')) {
        userFriendlyError = 'This video requires authentication to view';
      } else if (error.message?.includes('blocked')) {
        userFriendlyError = 'Content is geo-blocked or restricted';
      } else if (error.message?.includes('timeout')) {
        userFriendlyError = 'Request timed out - the platform might be slow or unavailable';
      }

      throw new Error(userFriendlyError);
    }
  }

  async downloadVideo(url: string, options: DownloadOptions = {}): Promise<Buffer> {
    // Check if yt-dlp is available
    try {
      const { stdout } = await execAsync('yt-dlp --version');
      console.log('yt-dlp version:', stdout.trim());
    } catch (error) {
      throw new Error('yt-dlp is not installed or not in PATH. Please install it using: pip install yt-dlp');
    }

    const needsClipping = !!(options.startTime || options.endTime);

    if (needsClipping) {
      return this.downloadAndClip(url, options);
    } else {
      return this.directDownload(url, options);
    }
  }

  private async directDownload(url: string, options: DownloadOptions): Promise<Buffer> {
    const args = [
      '-f', options.format || 'best',
      '--no-warnings',
      '--no-check-certificate',
      '--no-playlist',
      '--ignore-errors',
      '--geo-bypass',
      '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      '-o', '-',
      url
    ];

    return new Promise<Buffer>((resolve, reject) => {
      const child = spawn('yt-dlp', args, {
        stdio: ['ignore', 'pipe', 'pipe']
      });

      let errorOutput = '';
      let hasData = false;
      let dataChunks: Buffer[] = [];

      child.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      child.stdout.on('data', (chunk) => {
        hasData = true;
        dataChunks.push(chunk);
      });

      child.on('exit', (code) => {
        if (code !== 0 || !hasData) {
          reject(new Error(`Download failed: ${errorOutput}`));
          return;
        }

        const finalBuffer = Buffer.concat(dataChunks);
        resolve(finalBuffer);
      });
    });
  }

  private async downloadAndClip(url: string, options: DownloadOptions): Promise<Buffer> {
    const tempDir = tmpdir();
    const tempVideoPath = join(tempDir, `temp_video_${Date.now()}.mp4`);

    try {
      // Step 1: Download video to temporary file
      const downloadArgs = [
        '-f', options.format || 'best',
        '--no-warnings',
        '--no-check-certificate',
        '--no-playlist',
        '--ignore-errors',
        '--geo-bypass',
        '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        '-o', tempVideoPath,
        url
      ];

      await new Promise<void>((resolve, reject) => {
        const downloadChild = spawn('yt-dlp', downloadArgs, {
          stdio: ['ignore', 'pipe', 'pipe']
        });

        let downloadError = '';
        downloadChild.stderr.on('data', (data) => {
          downloadError += data.toString();
        });

        downloadChild.on('exit', (code) => {
          if (code === 0) {
            resolve();
          } else {
            reject(new Error(`Download failed: ${downloadError}`));
          }
        });
      });

      // Check if file exists
      try {
        await access(tempVideoPath);
      } catch {
        throw new Error('Downloaded video file not found');
      }

      // Step 2: Process with ffmpeg
      const processingOptions: ProcessingOptions = {
        startTime: this.parseTimeToSeconds(options.startTime || ''),
        endTime: this.parseTimeToSeconds(options.endTime || ''),
      };

      const clippedBuffer = await this.processVideo(tempVideoPath, processingOptions);

      // Cleanup
      try {
        await unlink(tempVideoPath);
      } catch (cleanupError) {
        console.warn('Failed to clean up temp file:', cleanupError);
      }

      return clippedBuffer;
    } catch (error: any) {
      // Cleanup on error
      try {
        await unlink(tempVideoPath).catch(() => {});
      } catch {}

      throw new Error(`Clipped download failed: ${error.message}`);
    }
  }

  async processVideo(inputPath: string, options: ProcessingOptions): Promise<Buffer> {
    const tempDir = tmpdir();
    const outputPath = join(tempDir, `processed_${Date.now()}.mp4`);

    try {
      const args = ['-i', inputPath];

      if (options.startTime !== null && options.startTime !== undefined) {
        args.push('-ss', options.startTime.toString());
      }

      if (options.endTime !== null && options.endTime !== undefined && 
          options.startTime !== null && options.startTime !== undefined) {
        const duration = options.endTime - options.startTime;
        args.push('-t', duration.toString());
      } else if (options.endTime !== null && options.endTime !== undefined) {
        args.push('-t', options.endTime.toString());
      }

      args.push(
        '-c', 'copy',
        '-avoid_negative_ts', 'make_zero',
        '-y',
        outputPath
      );

      await new Promise<void>((resolve, reject) => {
        const ffmpegProcess = spawn('ffmpeg', args, {
          stdio: ['ignore', 'pipe', 'pipe']
        });

        let errorOutput = '';
        ffmpegProcess.stderr.on('data', (data) => {
          errorOutput += data.toString();
        });

        ffmpegProcess.on('exit', (code) => {
          if (code === 0) {
            resolve();
          } else {
            reject(new Error(`ffmpeg failed: ${errorOutput}`));
          }
        });
      });

      // Read processed file
      const fs = require('fs').promises;
      const processedBuffer = await fs.readFile(outputPath);

      // Cleanup
      try {
        await unlink(outputPath);
      } catch (cleanupError) {
        console.warn('Failed to clean up processed file:', cleanupError);
      }

      return processedBuffer;
    } catch (error: any) {
      // Cleanup on error
      try {
        await unlink(outputPath).catch(() => {});
      } catch {}

      if (error.message.includes('ffmpeg')) {
        throw new Error('ffmpeg is required for video clipping but is not available on the server. Please install ffmpeg with: sudo apt install ffmpeg (Ubuntu/Debian) or brew install ffmpeg (macOS)');
      }

      throw new Error(`Video processing failed: ${error.message}`);
    }
  }

  private formatVideoInfo(info: any, url: string): VideoInfo {
    const platform = this.detectPlatform(url, info.extractor);
    const bestFormat = info.formats?.find((f: any) => 
      f.format_id === 'best' || f.quality === 'best'
    ) || info.formats?.[0];
    
    const estimatedSize = bestFormat?.filesize ? 
      this.formatFileSize(bestFormat.filesize) : 
      this.estimateSizeFromDuration(info.duration);

    return {
      thumbnail: info.thumbnail || info.thumbnails?.[0]?.url || this.generateDefaultThumbnail(platform),
      title: info.title || 'Untitled Video',
      duration: this.formatDuration(info.duration),
      platform: platform,
      fileSize: estimatedSize,
      formats: info.formats?.slice(0, 15).map((f: any) => ({
        id: f.format_id,
        ext: f.ext,
        quality: f.format_note || f.height || f.resolution || f.quality || 'unknown',
        filesize: f.filesize,
      })) || [],
      uploader: info.uploader || info.channel || 'Unknown',
      uploadDate: info.upload_date ? this.formatUploadDate(info.upload_date) : undefined,
      viewCount: info.view_count ? this.formatViewCount(info.view_count) : undefined,
      likeCount: info.like_count ? this.formatNumber(info.like_count) : undefined,
    };
  }

  private parseTimeToSeconds(timeStr: string): number | undefined {
    if (!timeStr) return undefined;
    
    const parts = timeStr.split(':').map(Number);
    if (parts.some(isNaN)) return undefined;
    
    if (parts.length === 2) {
      return parts[0] * 60 + parts[1];
    } else if (parts.length === 3) {
      return parts[0] * 3600 + parts[1] * 60 + parts[2];
    }
    return undefined;
  }

  private detectPlatform(url: string, extractor?: string): string {
    const platformMap: Record<string, string> = {
      'youtube': 'YouTube',
      'vimeo': 'Vimeo',
      'dailymotion': 'Dailymotion',
      'instagram': 'Instagram',
      'pinterest': 'Pinterest',
      'tiktok': 'TikTok',
      'twitter/x': 'Twitter/X',
      'facebook': 'Facebook',
      'twitch': 'Twitch',
      'reddit': 'Reddit',
      'soundcloud': 'SoundCloud',
    };

    if (extractor) {
      const extractorLower = extractor.toLowerCase();
      for (const [key, value] of Object.entries(platformMap)) {
        if (extractorLower.includes(key)) {
          return value;
        }
      }
    }

    const urlLower = url.toLowerCase();
    for (const [key, value] of Object.entries(platformMap)) {
      if (urlLower.includes(key)) {
        return value;
      }
    }

    return '🌐 Unknown Platform';
  }

  private formatDuration(seconds: number): string {
    if (!seconds || seconds <= 0) return '0:00';
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    
    return hours > 0
      ? `${hours}:${this.padZero(minutes)}:${this.padZero(remainingSeconds)}`
      : `${minutes}:${this.padZero(remainingSeconds)}`;
  }

  private padZero(num: number): string {
    return num.toString().padStart(2, '0');
  }

  private formatFileSize(bytes: number): string {
    if (!bytes) return 'Unknown size';
    
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    
    return Math.round((bytes / Math.pow(1024, i)) * 100) / 100 + ' ' + sizes[i];
  }

  private estimateSizeFromDuration(duration: number): string {
    if (!duration) return 'Unknown size';
    
    const estimatedMB = Math.round(duration / 60);
    return `~${estimatedMB} MB`;
  }

  private generateDefaultThumbnail(platform: string): string {
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
    return `data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180" viewBox="0 0 320 180"><rect width="320" height="180" fill="%23f3f4f6"/><text x="160" y="90" font-family="Arial, sans-serif" font-size="60" text-anchor="middle" dy="0.35em">${emoji}</text></svg>`;
  }

  private formatUploadDate(dateStr: string): string {
    if (!dateStr) return '';
    
    const year = dateStr.substring(0, 4);
    const month = dateStr.substring(4, 6);
    const day = dateStr.substring(6, 8);
    
    try {
      const date = new Date(`${year}-${month}-${day}`);
      return date.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
      });
    } catch {
      return dateStr;
    }
  }

  private formatViewCount(count: number): string {
    if (count < 1000) return count.toString();
    if (count < 1000000) return Math.round(count / 1000) + 'K';
    if (count < 1000000000) return Math.round(count / 1000000) + 'M';
    return Math.round(count / 1000000000) + 'B';
  }

  private formatNumber(num: number): string {
    if (num < 1000) return num.toString();
    if (num < 1000000) return Math.round(num / 1000) + 'K';
    return Math.round(num / 1000000) + 'M';
  }

  async getThumbnails(url: string, options: ThumbnailOptions = {}): Promise<ThumbnailInfo[]> {
    // Check if yt-dlp is available
    try {
      await execAsync('yt-dlp --version', { timeout: 5000 });
    } catch (error) {
      throw new Error('yt-dlp is not installed or not in PATH. Please install it using: pip install yt-dlp');
    }

    try {
      // Get thumbnail URLs using yt-dlp
      const command = `yt-dlp "${url}" --list-thumbnails --no-warnings --no-check-certificates --geo-bypass --user-agent "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"`;
      
      const { stdout, stderr } = await execAsync(command, { 
        timeout: 30000,
        maxBuffer: 1024 * 1024 * 5 // 5MB buffer
      });

      if (stderr) {
        console.warn('yt-dlp thumbnail warnings:', stderr);
      }

      // Parse thumbnail list from yt-dlp output
      const thumbnails = this.parseThumbnailList(stdout);
      
      if (thumbnails.length === 0) {
        // Fallback: try to get thumbnail URL from video info
        const infoCommand = `yt-dlp "${url}" --dump-single-json --no-check-certificates --no-warnings --format best --user-agent "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"`;
        
        try {
          const { stdout: infoStdout } = await execAsync(infoCommand, { timeout: 30000 });
          const info = JSON.parse(infoStdout);
          
          if (info.thumbnail) {
            return [{
              url: info.thumbnail,
              width: 'unknown',
              height: 'unknown',
              quality: 'default'
            }];
          }
        } catch (infoError) {
          console.warn('Failed to get video info for thumbnail fallback:', infoError);
        }
        
        // Final fallback: generate default thumbnail
        const platform = this.detectPlatform(url);
        return [{
          url: this.generateDefaultThumbnail(platform),
          width: '320',
          height: '180',
          quality: 'default'
        }];
      }

      return thumbnails;
    } catch (execError: any) {
      console.error('yt-dlp thumbnail error:', execError);
      
      // Fallback: generate default thumbnail
      const platform = this.detectPlatform(url);
      return [{
        url: this.generateDefaultThumbnail(platform),
        width: '320',
        height: '180',
        quality: 'default'
      }];
    }
  }

  private parseThumbnailList(output: string): ThumbnailInfo[] {
    const thumbnails: ThumbnailInfo[] = [];
    
    // Parse yt-dlp thumbnail list output
    const lines = output.split('\n');
    
    for (const line of lines) {
      // Look for lines containing thumbnail URLs
      if (line.includes('http') && (line.includes('.jpg') || line.includes('.png') || line.includes('.webp'))) {
        const parts = line.trim().split(/\s+/);
        
        // Extract URL (usually the last part containing http)
        const urlPart = parts.find(part => part.startsWith('http'));
        if (!urlPart) continue;
        
        // Extract dimensions if available
        const dimensionMatch = line.match(/(\d+)x(\d+)/);
        const width = dimensionMatch ? dimensionMatch[1] : 'unknown';
        const height = dimensionMatch ? dimensionMatch[2] : 'unknown';
        
        // Determine quality based on dimensions or URL
        let quality = 'default';
        if (urlPart.includes('maxres')) quality = 'maxres';
        else if (urlPart.includes('hq')) quality = 'high';
        else if (urlPart.includes('mq')) quality = 'medium';
        else if (dimensionMatch) {
          const pixels = parseInt(width) * parseInt(height);
          if (pixels > 900000) quality = 'maxres';
          else if (pixels > 200000) quality = 'high';
          else if (pixels > 50000) quality = 'medium';
        }
        
        thumbnails.push({
          url: urlPart,
          width,
          height,
          quality
        });
      }
    }
    
    return thumbnails;
  }
}

/**
 * Factory function to create the appropriate video processor based on platform and available tools
 */
export async function createVideoProcessor(): Promise<VideoProcessor> {
  const tools = await dependencyChecker.getAvailableTools();
  
  // Detect deployment platform
  const platform = detectDeploymentPlatform();
  
  console.log('Platform detected:', platform);
  console.log('Available tools:', tools);

  // Prefer package-based processor for Vercel
  if (platform === 'vercel' && tools.ytdlp === 'package' && tools.ffmpeg === 'package') {
    console.log('Using VercelVideoProcessor (package-based)');
    return new VercelVideoProcessor();
  }

  // Use system processor if binaries are available
  if (tools.ytdlp === 'binary' && tools.ffmpeg === 'binary') {
    console.log('Using SystemVideoProcessor (binary-based)');
    return new SystemVideoProcessor();
  }

  // Fallback to package processor if available
  if (tools.ytdlp === 'package' && tools.ffmpeg === 'package') {
    console.log('Using VercelVideoProcessor as fallback (package-based)');
    return new VercelVideoProcessor();
  }

  // If no suitable processor is available, throw an error
  throw new Error(`No suitable video processor available. Available tools: yt-dlp=${tools.ytdlp}, ffmpeg=${tools.ffmpeg}. Platform: ${platform}`);
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
 * Get platform-specific error messages and suggestions
 */
export function getPlatformErrorInfo(platform: string, missingTools: string[]): {
  error: string;
  suggestions: string[];
} {
  const errorMessages: Record<string, { error: string; suggestions: string[] }> = {
    vercel: {
      error: 'Video processing tools are not available in Vercel\'s serverless environment',
      suggestions: [
        'Install yt-dlp-exec and ffmpeg-static packages: npm install yt-dlp-exec ffmpeg-static',
        'Update next.config.js to include these packages in serverComponentsExternalPackages',
        'Consider deploying to Railway or another platform that supports system binaries'
      ]
    },
    railway: {
      error: 'System dependencies are not installed',
      suggestions: [
        'Add yt-dlp and ffmpeg to your nixpacks.toml configuration',
        'Ensure your Dockerfile includes: RUN apt-get update && apt-get install -y yt-dlp ffmpeg',
        'Check that the binaries are in the system PATH'
      ]
    },
    local: {
      error: 'Required video processing tools are not installed locally',
      suggestions: [
        'Install yt-dlp: pip install yt-dlp',
        'Install ffmpeg: brew install ffmpeg (macOS) or sudo apt install ffmpeg (Ubuntu/Debian)',
        'Ensure both tools are available in your system PATH'
      ]
    },
    production: {
      error: 'Video processing dependencies are missing in production',
      suggestions: [
        'Install system dependencies: yt-dlp and ffmpeg',
        'Or install npm packages: yt-dlp-exec and ffmpeg-static',
        'Check your deployment configuration and build process'
      ]
    }
  };

  return errorMessages[platform] || errorMessages.production;
}