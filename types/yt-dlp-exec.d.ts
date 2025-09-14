declare module 'yt-dlp-exec' {
  interface YtDlpOptions {
    dumpSingleJson?: boolean;
    noCheckCertificates?: boolean;
    noWarnings?: boolean;
    preferFreeFormats?: boolean;
    format?: string;
    [key: string]: any;
  }

  interface VideoInfo {
    title: string;
    thumbnail: string;
    duration: number;
    formats: any[];
    [key: string]: any;
  }

  function ytDlp(url: string, options?: YtDlpOptions): Promise<VideoInfo>;
  
  export = ytDlp;
} 