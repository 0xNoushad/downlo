import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface ToolAvailability {
  ytdlp: 'binary' | 'package' | 'none';
  ffmpeg: 'binary' | 'package' | 'none';
}

export interface DependencyChecker {
  checkYtDlp(): Promise<boolean>;
  checkFFmpeg(): Promise<boolean>;
  getAvailableTools(): Promise<ToolAvailability>;
}

class DependencyCheckerImpl implements DependencyChecker {
  private toolCache: ToolAvailability | null = null;
  private cacheExpiry: number = 0;
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  /**
   * Check if yt-dlp is available (binary or package)
   */
  async checkYtDlp(): Promise<boolean> {
    const tools = await this.getAvailableTools();
    return tools.ytdlp !== 'none';
  }

  /**
   * Check if ffmpeg is available (binary or package)
   */
  async checkFFmpeg(): Promise<boolean> {
    const tools = await this.getAvailableTools();
    return tools.ffmpeg !== 'none';
  }

  /**
   * Get detailed availability information for all tools
   */
  async getAvailableTools(): Promise<ToolAvailability> {
    // Return cached result if still valid
    if (this.toolCache && Date.now() < this.cacheExpiry) {
      return this.toolCache;
    }

    const tools: ToolAvailability = {
      ytdlp: await this.detectYtDlpAvailability(),
      ffmpeg: await this.detectFFmpegAvailability()
    };

    // Cache the result
    this.toolCache = tools;
    this.cacheExpiry = Date.now() + this.CACHE_DURATION;

    return tools;
  }

  /**
   * Detect yt-dlp availability (binary first, then package)
   */
  private async detectYtDlpAvailability(): Promise<'binary' | 'package' | 'none'> {
    // First check for system binary
    if (await this.checkSystemBinary('yt-dlp --version')) {
      return 'binary';
    }

    // Then check for package availability
    if (await this.checkPackageAvailability('yt-dlp-exec')) {
      return 'package';
    }

    return 'none';
  }

  /**
   * Detect ffmpeg availability (binary first, then package)
   */
  private async detectFFmpegAvailability(): Promise<'binary' | 'package' | 'none'> {
    // First check for system binary
    if (await this.checkSystemBinary('ffmpeg -version')) {
      return 'binary';
    }

    // Then check for package availability
    if (await this.checkPackageAvailability('ffmpeg-static')) {
      return 'package';
    }

    return 'none';
  }

  /**
   * Check if a system binary is available
   */
  private async checkSystemBinary(command: string): Promise<boolean> {
    try {
      await execAsync(command, { timeout: 5000 });
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Check if a package is available for import
   */
  private async checkPackageAvailability(packageName: string): Promise<boolean> {
    try {
      // Try to require the package to see if it's available
      await import(packageName);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Clear the cache (useful for testing or when dependencies change)
   */
  clearCache(): void {
    this.toolCache = null;
    this.cacheExpiry = 0;
  }
}

// Export singleton instance
export const dependencyChecker: DependencyChecker = new DependencyCheckerImpl();

// Export class for testing
export { DependencyCheckerImpl };