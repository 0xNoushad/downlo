"use client";

import { forwardRef, type ReactNode } from "react";
import { Loader2, Play, Pause, Volume2, VolumeX } from "lucide-react";

interface VideoPlayerProps {
  videoUrl: string;
  isPlaying: boolean;
  isLoading: boolean;
  isMuted: boolean;
  onTogglePlay: () => void;
  onToggleMute: () => void;
  onPlay: () => void;
  onPause: () => void;
  children?: ReactNode;
}

export const VideoPlayer = forwardRef<HTMLVideoElement, VideoPlayerProps>(({
  videoUrl,
  isPlaying,
  isLoading,
  isMuted,
  onTogglePlay,
  onToggleMute,
  onPlay,
  onPause,
  children,
}, ref) => {
  return (
    <div className="relative aspect-[9/16] max-h-[70vh] mx-auto bg-black rounded-lg overflow-hidden">
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-30">
          <Loader2 className="w-8 h-8 animate-spin text-white" />
        </div>
      )}
      <video
        ref={ref}
        src={videoUrl}
        className="h-full w-auto max-w-none absolute left-1/2 -translate-x-1/2"
        style={{ aspectRatio: "16/9" }}
        muted={isMuted}
        autoPlay
        playsInline
        preload="auto"
        onPlay={onPlay}
        onPause={onPause}
        onLoadedData={(e) => {
          const video = e.currentTarget;
          video.volume = 1;
        }}
      />
      {/* Caption overlay slot */}
      {children}
      <button
        onClick={onTogglePlay}
        className="absolute inset-0 flex items-center justify-center group z-10"
      >
        <div className="w-16 h-16 rounded-full bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          {isPlaying ? (
            <Pause className="w-7 h-7 text-white" />
          ) : (
            <Play className="w-7 h-7 text-white ml-1" />
          )}
        </div>
      </button>
      {/* Volume control */}
      <button
        onClick={onToggleMute}
        className="absolute bottom-3 right-3 p-2 rounded-full bg-black/60 hover:bg-black/80 transition-colors z-20"
      >
        {isMuted ? (
          <VolumeX className="w-5 h-5 text-white" />
        ) : (
          <Volume2 className="w-5 h-5 text-white" />
        )}
      </button>
    </div>
  );
});

VideoPlayer.displayName = "VideoPlayer";
