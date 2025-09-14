"use client";

import React, { useState } from "react";

interface ClipSelectorProps {
  duration: string;
  startTime: string;
  endTime: string;
  onStartTimeChange: (time: string) => void;
  onEndTimeChange: (time: string) => void;
  onReset: () => void;
}

export function ClipSelector({
  duration,
  startTime,
  endTime,
  onStartTimeChange,
  onEndTimeChange,
  onReset,
}: ClipSelectorProps) {
  const [enabled, setEnabled] = useState(false);

  // Sync enabled state with actual clip values
  const hasClipValues = Boolean(startTime || endTime);

  const handleToggle = () => {
    const newEnabled = !enabled;
    setEnabled(newEnabled);
    if (!newEnabled) {
      onReset();
    }
  };

  // Update enabled state when clip values change externally
  React.useEffect(() => {
    setEnabled(hasClipValues);
  }, [hasClipValues]);

  const validateTime = (time: string): boolean => {
    if (!time) return true;
    const parts = time.split(":");
    return parts.every((part) => !isNaN(Number(part)));
  };

  return (
    <div className="border border-dashed overflow-hidden">
      <div className="flex items-center justify-between p-3 border-b border-dashed bg-card">
        <div>
          <h3 className="font-medium text-sm">clip settings</h3>
          <p className="text-xs text-muted-foreground">
            download specific part of video
          </p>
        </div>
        <button
          onClick={handleToggle}
          className={`relative inline-flex h-6 w-11 items-center border border-dashed transition-colors ${
            enabled ? "bg-foreground" : "bg-transparent"
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform transition-transform ${
              enabled
                ? "translate-x-6 bg-background"
                : "translate-x-1 bg-foreground"
            }`}
          />
        </button>
      </div>

      {enabled && (
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                start time
              </label>
              <input
                type="text"
                value={startTime}
                onChange={(e) => onStartTimeChange(e.target.value)}
                placeholder="0:00"
                className={`w-full px-3 py-2 border border-dashed bg-transparent focus:ring-0 focus:outline-none ${
                  !validateTime(startTime)
                    ? "border-red-500"
                    : "border-muted-foreground"
                }`}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">end time</label>
              <input
                type="text"
                value={endTime}
                onChange={(e) => onEndTimeChange(e.target.value)}
                placeholder={duration || "5:00"}
                className={`w-full px-3 py-2 border border-dashed bg-transparent focus:ring-0 focus:outline-none ${
                  !validateTime(endTime)
                    ? "border-red-500"
                    : "border-muted-foreground"
                }`}
              />
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => {
                onStartTimeChange("0:00");
                onEndTimeChange("0:30");
              }}
              className="px-3 py-1 text-xs border border-dashed hover:bg-muted"
            >
              first 30s
            </button>
            <button
              onClick={() => {
                onStartTimeChange("0:00");
                onEndTimeChange("1:00");
              }}
              className="px-3 py-1 text-xs border border-dashed hover:bg-muted"
            >
              first 1min
            </button>
            <button
              onClick={onReset}
              className="px-3 py-1 text-xs border border-dashed hover:bg-muted"
            >
              clear
            </button>
          </div>

          {(startTime || endTime) && (
            <div className="p-3 border border-dashed border-blue-500 bg-blue-500/10">
              <p className="text-sm text-blue-400">
                ✂️ clip: {startTime || "0:00"} → {endTime || duration}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
