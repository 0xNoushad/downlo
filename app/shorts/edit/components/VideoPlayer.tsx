"use client";

import { forwardRef } from "react";
import { Loader2, Play, Pause } from "lucide-react";

interface VideoPlayerProps {
  videoUrl: string;
  isPlaying: boolean;
  isLoading: boolean;
  isMuted: boolean;
  onTogglePlay: () => void;
  onPlay: () => void;
  onPause: () => void;
}

export const VideoPlayer = forwardRef<HTMLVideoElement, VideoPlayerProps>(({
  videoUrl,
  isPlaying,
  isLoading,
  isMuted,
  onTogglePlay,
  onPlay,
  onPause,
}, ref) => {
  return (
    <div className="relative aspect-[9/16] max-h-[70vh] mx-auto bg-black rounded-lg overflow-hidden">
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-10">
          <Loader2 className="w-8 h-8 animate-spin text-white" />
        </div>
      )}
      <video
        ref={ref}
        src={videoUrl}
        className="w-full h-full object-cover"
        muted={isMuted}
        playsInline
        preload="auto"
        onPlay={onPlay}
        onPause={onPause}
      />
      <button
        onClick={onTogglePlay}
        className="absolute inset-0 flex items-center justify-center group"
      >
        <div className="w-16 h-16 rounded-full bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          {isPlaying ? (
            <Pause className="w-7 h-7 text-white" />
          ) : (
            <Play className="w-7 h-7 text-white ml-1" />
          )}
        </div>
      </button>
    </div>
  );
});

VideoPlayer.displayName = "VideoPlayer";
