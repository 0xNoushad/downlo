"use client";

import { Play, Clock } from "lucide-react";

interface Short {
  id: string;
  thumbnail: string;
  title: string;
  startTime: number;
  endTime: number;
  transcript: string;
}

interface VideoInfo {
  title: string;
  thumbnail: string;
}

interface ShortsListProps {
  shorts: Short[];
  selectedIndex: number;
  videoInfo: VideoInfo | null;
  onShortClick: (index: number) => void;
}

export function ShortsList({ shorts, selectedIndex, videoInfo, onShortClick }: ShortsListProps) {
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="flex-1 space-y-4 min-w-0">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-medium">{shorts.length} Shorts Found</h2>
      </div>

      <div className="grid gap-3">
        {shorts.map((short, index) => (
          <ShortCard
            key={short.id}
            short={short}
            index={index}
            isSelected={selectedIndex === index}
            thumbnail={short.thumbnail || videoInfo?.thumbnail}
            onClick={() => onShortClick(index)}
            formatTime={formatTime}
          />
        ))}
      </div>
    </div>
  );
}

interface ShortCardProps {
  short: Short;
  index: number;
  isSelected: boolean;
  thumbnail?: string;
  onClick: () => void;
  formatTime: (seconds: number) => string;
}

function ShortCard({ short, index, isSelected, thumbnail, onClick, formatTime }: ShortCardProps) {
  const duration = short.endTime - short.startTime;

  return (
    <div
      onClick={onClick}
      className={`p-4 cursor-pointer transition-all ${
        isSelected 
          ? "bg-foreground text-background" 
          : "border border-dashed hover:bg-muted"
      }`}
    >
      <div className="flex gap-4">
        <div className="w-28 h-16 bg-black shrink-0 relative overflow-hidden">
          {thumbnail && <img src={thumbnail} alt="" className="w-full h-full object-cover" />}
          <div className={`absolute inset-0 flex items-center justify-center ${isSelected ? "bg-background/30" : "bg-black/40"}`}>
            {isSelected ? (
              <div className="flex items-center gap-1">
                <span className="w-1.5 h-4 bg-background animate-pulse" />
                <span className="w-1.5 h-4 bg-background animate-pulse delay-75" />
                <span className="w-1.5 h-4 bg-background animate-pulse delay-150" />
              </div>
            ) : (
              <Play className="w-5 h-5 text-white fill-white" />
            )}
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-medium">
              Short #{index + 1}
              {isSelected && <span className="ml-2 text-xs font-normal opacity-70">Playing</span>}
            </h3>
            <div className={`flex items-center gap-1 text-xs shrink-0 ${isSelected ? "opacity-70" : "text-muted-foreground"}`}>
              <Clock className="w-3 h-3" />
              {duration}s
            </div>
          </div>
          <p className={`text-sm mt-1 line-clamp-2 ${isSelected ? "opacity-80" : "text-muted-foreground"}`}>
            {short.transcript}
          </p>
          <div className={`text-xs mt-2 ${isSelected ? "opacity-60" : "text-muted-foreground"}`}>
            {formatTime(short.startTime)} - {formatTime(short.endTime)}
          </div>
        </div>
      </div>
    </div>
  );
}
