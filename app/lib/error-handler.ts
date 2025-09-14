import { getPlatformConfig, detectDeploymentPlatformDetailed, getPlatformErrorMessages } from './platform-config';
import { dependencyChecker, ToolAvailability } from './dependency-checker';

export interface ApiError {
    code: string;
    message: string;
    details?: string;
    platform: string;
    suggestions: string[];
    context?: Record<string, any>;
    timestamp: string;
    requestId?: string;
}

export interface ErrorContext {
    operation: string;
    url?: string;
    format?: string;
    fileSize?: number;
    duration?: number;
    platform: string;
    tools: ToolAvailability;
    requestId?: string;
}

export enum ErrorCode {
    // Dependency errors
    MISSING_YTDLP = 'MISSING_YTDLP',
    MISSING_FFMPEG = 'MISSING_FFMPEG',
    DEPENDENCY_UNAVAILABLE = 'DEPENDENCY_UNAVAILABLE',

    // Platform errors
    PLATFORM_LIMITATION = 'PLATFORM_LIMITATION',
    TIMEOUT_EXCEEDED = 'TIMEOUT_EXCEEDED',
    FILE_SIZE_EXCEEDED = 'FILE_SIZE_EXCEEDED',
    MEMORY_EXCEEDED = 'MEMORY_EXCEEDED',

    // Processing errors
    DOWNLOAD_FAILED = 'DOWNLOAD_FAILED',
    PROCESSING_FAILED = 'PROCESSING_FAILED',
    FORMAT_UNSUPPORTED = 'FORMAT_UNSUPPORTED',
    URL_INVALID = 'URL_INVALID',

    // System errors
    SYSTEM_ERROR = 'SYSTEM_ERROR',
    NETWORK_ERROR = 'NETWORK_ERROR',
    STORAGE_ERROR = 'STORAGE_ERROR',
}

/**
 * Enhanced error handler with platform-aware messaging
 */
export class ErrorHandler {
    private static instance: ErrorHandler;
    private platformInfo: ReturnType<typeof detectDeploymentPlatformDetailed>;
    private platformConfig: ReturnType<typeof getPlatformConfig>;
    private errorMessages: ReturnType<typeof getPlatformErrorMessages>;

    private constructor() {
        this.platformInfo = detectDeploymentPlatformDetailed();
        this.platformConfig = getPlatformConfig();
        this.errorMessages = getPlatformErrorMessages();
    }

    public static getInstance(): ErrorHandler {
        if (!ErrorHandler.instance) {
            ErrorHandler.instance = new ErrorHandler();
        }
        return ErrorHandler.instance;
    }  /**
 
  * Create a standardized API error with platform-specific context
   */
    public async createError(
        code: ErrorCode,
        baseMessage: string,
        context: Partial<ErrorContext> = {},
        originalError?: Error
    ): Promise<ApiError> {
        const tools = await dependencyChecker.getAvailableTools();
        const fullContext: ErrorContext = {
            operation: 'unknown',
            platform: this.platformInfo.platform,
            tools,
            ...context,
        };

        const platformSpecificMessage = this.getPlatformSpecificMessage(code, baseMessage, fullContext);
        const suggestions = this.getSuggestions(code, fullContext);

        const error: ApiError = {
            code,
            message: platformSpecificMessage,
            details: originalError?.message,
            platform: this.platformInfo.platform,
            suggestions,
            context: {
                ...fullContext,
                platformConfidence: this.platformInfo.confidence,
                platformIndicators: this.platformInfo.indicators,
                capabilities: this.platformInfo.capabilities,
            },
            timestamp: new Date().toISOString(),
            requestId: fullContext.requestId || this.generateRequestId(),
        };

        // Log error with context
        this.logError(error, originalError);

        return error;
    }

    /**
     * Get platform-specific error message
     */
    private getPlatformSpecificMessage(code: ErrorCode, baseMessage: string, context: ErrorContext): string {
        const platform = this.platformInfo.platform;

        switch (code) {
            case ErrorCode.MISSING_YTDLP:
                return platform === 'vercel'
                    ? `${baseMessage}. Using JavaScript package fallback for video processing.`
                    : `${baseMessage}. ${this.errorMessages.missingBinary}`;

            case ErrorCode.MISSING_FFMPEG:
                return platform === 'vercel'
                    ? `${baseMessage}. Using JavaScript package fallback for video processing.`
                    : `${baseMessage}. ${this.errorMessages.missingBinary}`;

            case ErrorCode.TIMEOUT_EXCEEDED:
                return `${baseMessage}. ${this.errorMessages.timeout}`;

            case ErrorCode.FILE_SIZE_EXCEEDED:
                return `${baseMessage}. ${this.errorMessages.fileSize}`;

            case ErrorCode.PLATFORM_LIMITATION:
                return `${baseMessage}. Platform: ${platform} has limitations that prevent this operation.`;

            case ErrorCode.FORMAT_UNSUPPORTED:
                const supportedFormats = this.platformConfig.supportedFormats.join(', ');
                return `${baseMessage}. Supported formats on ${platform}: ${supportedFormats}`;

            default:
                return baseMessage;
        }
    }

    /**
     * Get platform-specific suggestions for error resolution
     */
    private getSuggestions(code: ErrorCode, context: ErrorContext): string[] {
        const baseSuggestions = this.errorMessages.suggestions;
        const platformSuggestions: string[] = [...baseSuggestions];

        switch (code) {
            case ErrorCode.MISSING_YTDLP:
            case ErrorCode.MISSING_FFMPEG:
                if (context.tools.ytdlp === 'none' && context.tools.ffmpeg === 'none') {
                    platformSuggestions.push('No video processing tools available. Consider switching platforms.');
                }
                break;

            case ErrorCode.FILE_SIZE_EXCEEDED:
                platformSuggestions.push(`Current limit: ${this.formatFileSize(this.platformConfig.maxFileSize)}`);
                if (context.fileSize) {
                    platformSuggestions.push(`Your file: ${this.formatFileSize(context.fileSize)}`);
                }
                break;

            case ErrorCode.TIMEOUT_EXCEEDED:
                platformSuggestions.push(`Current timeout: ${this.platformConfig.timeout / 1000}s`);
                if (context.duration) {
                    platformSuggestions.push(`Try processing shorter segments (current: ${context.duration}s)`);
                }
                break;

            case ErrorCode.FORMAT_UNSUPPORTED:
                if (context.format) {
                    const alternatives = this.getAlternativeFormats(context.format);
                    if (alternatives.length > 0) {
                        platformSuggestions.push(`Try these alternatives: ${alternatives.join(', ')}`);
                    }
                }
                break;
        }

        return platformSuggestions;
    }  /**

   * Log error with platform context
   */
    private logError(error: ApiError, originalError?: Error): void {
        const logData = {
            error: {
                code: error.code,
                message: error.message,
                platform: error.platform,
                timestamp: error.timestamp,
                requestId: error.requestId,
            },
            context: error.context,
            originalError: originalError ? {
                name: originalError.name,
                message: originalError.message,
                stack: originalError.stack,
            } : undefined,
        };

        // Use appropriate logging level based on error type
        if (this.isCriticalError(error.code)) {
            console.error('Critical API Error:', JSON.stringify(logData, null, 2));
        } else if (this.isWarningError(error.code)) {
            console.warn('API Warning:', JSON.stringify(logData, null, 2));
        } else {
            console.log('API Info:', JSON.stringify(logData, null, 2));
        }
    }

    /**
     * Check if error is critical
     */
    private isCriticalError(code: string): boolean {
        return [
            ErrorCode.SYSTEM_ERROR,
            ErrorCode.DEPENDENCY_UNAVAILABLE,
            ErrorCode.STORAGE_ERROR,
        ].includes(code as ErrorCode);
    }

    /**
     * Check if error is a warning
     */
    private isWarningError(code: string): boolean {
        return [
            ErrorCode.MISSING_YTDLP,
            ErrorCode.MISSING_FFMPEG,
            ErrorCode.PLATFORM_LIMITATION,
        ].includes(code as ErrorCode);
    }

    /**
     * Format file size for human readability
     */
    private formatFileSize(bytes: number): string {
        const units = ['B', 'KB', 'MB', 'GB'];
        let size = bytes;
        let unitIndex = 0;

        while (size >= 1024 && unitIndex < units.length - 1) {
            size /= 1024;
            unitIndex++;
        }

        return `${size.toFixed(1)}${units[unitIndex]}`;
    }

    /**
     * Get alternative formats for unsupported format
     */
    private getAlternativeFormats(format: string): string[] {
        const supportedFormats = this.platformConfig.supportedFormats;

        // Video format alternatives
        if (['avi', 'mkv', 'mov', 'flv'].includes(format.toLowerCase())) {
            return supportedFormats.filter(f => ['mp4', 'webm'].includes(f));
        }

        // Audio format alternatives
        if (['wav', 'flac', 'ogg', 'aac'].includes(format.toLowerCase())) {
            return supportedFormats.filter(f => ['mp3', 'm4a'].includes(f));
        }

        return supportedFormats.slice(0, 3); // Return first 3 supported formats
    }

    /**
     * Generate unique request ID
     */
    private generateRequestId(): string {
        return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Create error response for API routes
     */
    public createErrorResponse(error: ApiError, status: number = 500): Response {
        return new Response(JSON.stringify({
            success: false,
            error: {
                code: error.code,
                message: error.message,
                details: error.details,
                suggestions: error.suggestions,
                platform: error.platform,
                timestamp: error.timestamp,
                requestId: error.requestId,
            },
        }), {
            status,
            headers: {
                'Content-Type': 'application/json',
                'X-Request-ID': error.requestId || '',
                'X-Platform': error.platform,
            },
        });
    }

    /**
     * Refresh platform information (useful when environment changes)
     */
    public refresh(): void {
        this.platformInfo = detectDeploymentPlatformDetailed();
        this.platformConfig = getPlatformConfig();
        this.errorMessages = getPlatformErrorMessages();
    }
}/**

 * Convenience functions for common error scenarios
 */

/**
 * Create dependency missing error
 */
export async function createDependencyError(
    tool: 'ytdlp' | 'ffmpeg',
    operation: string,
    context: Partial<ErrorContext> = {}
): Promise<ApiError> {
    const errorHandler = ErrorHandler.getInstance();
    const code = tool === 'ytdlp' ? ErrorCode.MISSING_YTDLP : ErrorCode.MISSING_FFMPEG;
    const message = `${tool} is required for ${operation} but is not available`;

    return errorHandler.createError(code, message, { operation, ...context });
}

/**
 * Create platform limitation error
 */
export async function createPlatformLimitationError(
    limitation: string,
    operation: string,
    context: Partial<ErrorContext> = {}
): Promise<ApiError> {
    const errorHandler = ErrorHandler.getInstance();
    const message = `Platform limitation: ${limitation}`;

    return errorHandler.createError(ErrorCode.PLATFORM_LIMITATION, message, { operation, ...context });
}

/**
 * Create file size exceeded error
 */
export async function createFileSizeError(
    fileSize: number,
    operation: string,
    context: Partial<ErrorContext> = {}
): Promise<ApiError> {
    const errorHandler = ErrorHandler.getInstance();
    const message = `File size exceeds platform limits`;

    return errorHandler.createError(ErrorCode.FILE_SIZE_EXCEEDED, message, {
        operation,
        fileSize,
        ...context
    });
}

/**
 * Create timeout error
 */
export async function createTimeoutError(
    operation: string,
    duration?: number,
    context: Partial<ErrorContext> = {}
): Promise<ApiError> {
    const errorHandler = ErrorHandler.getInstance();
    const message = `Operation timed out during ${operation}`;

    return errorHandler.createError(ErrorCode.TIMEOUT_EXCEEDED, message, {
        operation,
        duration,
        ...context
    });
}

/**
 * Create processing error
 */
export async function createProcessingError(
    operation: string,
    originalError: Error,
    context: Partial<ErrorContext> = {}
): Promise<ApiError> {
    const errorHandler = ErrorHandler.getInstance();
    const message = `Processing failed during ${operation}`;

    return errorHandler.createError(ErrorCode.PROCESSING_FAILED, message, { operation, ...context }, originalError);
}

/**
 * Create format unsupported error
 */
export async function createFormatError(
    format: string,
    operation: string,
    context: Partial<ErrorContext> = {}
): Promise<ApiError> {
    const errorHandler = ErrorHandler.getInstance();
    const message = `Format '${format}' is not supported`;

    return errorHandler.createError(ErrorCode.FORMAT_UNSUPPORTED, message, {
        operation,
        format,
        ...context
    });
}

/**
 * Create URL invalid error
 */
export async function createUrlError(
    url: string,
    operation: string,
    context: Partial<ErrorContext> = {}
): Promise<ApiError> {
    const errorHandler = ErrorHandler.getInstance();
    const message = `Invalid or unsupported URL`;

    return errorHandler.createError(ErrorCode.URL_INVALID, message, {
        operation,
        url,
        ...context
    });
}

/**
 * Singleton instance for convenience
 */
export const errorHandler = ErrorHandler.getInstance();