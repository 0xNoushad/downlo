"use client";

import { Scissors, Clock } from "lucide-react";

interface TrimControlsProps {
  startTime: number;
  endTime: number;
  onAdjustStart: (delta: number) => void;
  onAdjustEnd: (delta: number) => void;
}

export function TrimControls({ startTime, endTime, onAdjustStart, onAdjustEnd }: TrimControlsProps) {
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 10);
    return `${mins}:${secs.toString().padStart(2, "0")}.${ms}`;
  };

  const clipDuration = endTime - startTime;

  return (
    <div className="p-4 border border-dashed space-y-4">
      <div className="flex items-center gap-2">
        <Scissors className="w-4 h-4" />
        <h3 className="font-medium">Trim</h3>
      </div>

      {/* Start Time */}
      <div className="space-y-2">
        <label className="text-sm text-muted-foreground">Start Time</label>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onAdjustStart(-1)}
            className="px-3 py-1 border border-dashed hover:bg-muted"
          >
            -1s
          </button>
          <div className="flex-1 text-center font-mono">{formatTime(startTime)}</div>
          <button
            onClick={() => onAdjustStart(1)}
            className="px-3 py-1 border border-dashed hover:bg-muted"
          >
            +1s
          </button>
        </div>
      </div>

      {/* End Time */}
      <div className="space-y-2">
        <label className="text-sm text-muted-foreground">End Time</label>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onAdjustEnd(-1)}
            className="px-3 py-1 border border-dashed hover:bg-muted"
          >
            -1s
          </button>
          <div className="flex-1 text-center font-mono">{formatTime(endTime)}</div>
          <button
            onClick={() => onAdjustEnd(1)}
            className="px-3 py-1 border border-dashed hover:bg-muted"
          >
            +1s
          </button>
        </div>
      </div>

      {/* Duration */}
      <div className="flex items-center justify-between text-sm pt-2 border-t border-dashed">
        <span className="flex items-center gap-2 text-muted-foreground">
          <Clock className="w-4 h-4" />
          Duration
        </span>
        <span className="font-mono">{clipDuration.toFixed(1)}s</span>
      </div>
    </div>
  );
}
