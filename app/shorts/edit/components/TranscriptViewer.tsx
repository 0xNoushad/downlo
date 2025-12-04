"use client";

import { useEffect, useRef } from "react";
import { Copy, Check } from "lucide-react";
import { useState } from "react";
import type { TranscriptSegment } from "./SyncedCaptions";

interface TranscriptViewerProps {
  segments: TranscriptSegment[];
  currentTime: number;
  onSegmentClick?: (time: number) => void;
  onSegmentEdit?: (index: number, text: string) => void;
}

export function TranscriptViewer({ 
  segments, 
  currentTime, 
  onSegmentClick,
  onSegmentEdit 
}: TranscriptViewerProps) {
  const [copied, setCopied] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const activeRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Find current segment
  const currentSegmentIndex = segments.findIndex(
    (seg) => currentTime >= seg.start && currentTime < seg.end
  );

  // Auto-scroll to active segment
  useEffect(() => {
    if (activeRef.current && containerRef.current) {
      const container = containerRef.current;
      const active = activeRef.current;
      const containerRect = container.getBoundingClientRect();
      const activeRect = active.getBoundingClientRect();
      
      if (activeRect.top < containerRect.top || activeRect.bottom > containerRect.bottom) {
        active.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }
  }, [currentSegmentIndex]);

  const copyFullTranscript = async () => {
    const fullText = segments.map(s => s.text).join(" ");
    await navigator.clipboard.writeText(fullText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDoubleClick = (index: number) => {
    if (onSegmentEdit) {
      setEditingIndex(index);
    }
  };

  const handleEditBlur = (index: number, newText: string) => {
    if (onSegmentEdit) {
      onSegmentEdit(index, newText);
    }
    setEditingIndex(null);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-dashed">
        <span className="text-xs text-muted-foreground">
          Live Transcript
        </span>
        <button
          onClick={copyFullTranscript}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
          {copied ? "Copied!" : "Copy all"}
        </button>
      </div>

      {/* Transcript content */}
      <div 
        ref={containerRef}
        className="flex-1 overflow-y-auto p-3 space-y-1 select-text"
      >
        {segments.map((seg, idx) => {
          const isActive = idx === currentSegmentIndex;
          const isPast = currentSegmentIndex > idx;
          
          return (
            <div
              key={idx}
              ref={isActive ? activeRef : null}
              onClick={() => onSegmentClick?.(seg.start)}
              onDoubleClick={() => handleDoubleClick(idx)}
              className={`
                relative px-2 py-1.5 rounded cursor-pointer transition-all duration-200
                ${isActive ? "bg-foreground/10" : "hover:bg-muted/50"}
              `}
            >
              {editingIndex === idx ? (
                <textarea
                  autoFocus
                  defaultValue={seg.text}
                  onBlur={(e) => handleEditBlur(idx, e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleEditBlur(idx, e.currentTarget.value);
                    }
                    if (e.key === "Escape") {
                      setEditingIndex(null);
                    }
                  }}
                  className="w-full text-sm bg-background border border-dashed rounded px-2 py-1 resize-none focus:outline-none focus:border-foreground"
                  rows={2}
                />
              ) : (
                <span
                  className={`
                    text-sm leading-relaxed inline
                    ${isPast ? "text-muted-foreground" : ""}
                    ${isActive ? "shimmer-text font-medium" : ""}
                  `}
                >
                  {seg.text}
                </span>
              )}
              
              {/* Time indicator on hover */}
              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                {formatTime(seg.start)}
              </span>
            </div>
          );
        })}
      </div>

      {/* Tip */}
      <div className="px-3 py-2 border-t border-dashed">
        <p className="text-[10px] text-muted-foreground">
          Click to seek • Double-click to edit
        </p>
      </div>
    </div>
  );
}

function formatTime(seconds: number) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}
