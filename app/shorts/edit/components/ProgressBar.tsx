"use client";

import { forwardRef } from "react";

interface ProgressBarProps {
  currentTime: number;
  duration: number;
  onSeek: (e: React.MouseEvent<HTMLDivElement>) => void;
}

export const ProgressBar = forwardRef<HTMLDivElement, ProgressBarProps>(({
  currentTime,
  duration,
  onSeek,
}, ref) => {
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 10);
    return `${mins}:${secs.toString().padStart(2, "0")}.${ms}`;
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="space-y-2">
      <div
        ref={ref}
        onClick={onSeek}
        className="h-2 bg-muted rounded-full cursor-pointer relative overflow-hidden"
      >
        <div
          className="absolute inset-y-0 left-0 bg-foreground rounded-full transition-all"
          style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
        />
      </div>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{formatTime(currentTime)}</span>
        <span>{formatTime(duration)}</span>
      </div>
    </div>
  );
});

ProgressBar.displayName = "ProgressBar";
