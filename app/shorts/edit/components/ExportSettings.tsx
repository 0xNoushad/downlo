"use client";

import { useState } from "react";
import { Settings2, ChevronDown, Download, Loader2 } from "lucide-react";

type Quality = "720" | "1080" | "best";

interface ExportSettingsProps {
  quality: Quality;
  onQualityChange: (quality: Quality) => void;
  isDownloading: boolean;
  onDownload: () => void;
}

export function ExportSettings({ quality, onQualityChange, isDownloading, onDownload }: ExportSettingsProps) {
  const [showQualityMenu, setShowQualityMenu] = useState(false);

  const qualityOptions = [
    { value: "720" as Quality, label: "720p HD" },
    { value: "1080" as Quality, label: "1080p Full HD" },
    { value: "best" as Quality, label: "Max Quality (4K if available)" },
  ];

  const currentLabel = qualityOptions.find(opt => opt.value === quality)?.label || "1080p (Full HD)";

  return (
    <div className="space-y-6">
      <div className="p-4 border border-dashed space-y-4">
        <div className="flex items-center gap-2">
          <Settings2 className="w-4 h-4" />
          <h3 className="font-medium">Export Settings</h3>
        </div>

        <p className="text-xs text-muted-foreground">
          Preview is 720p. Download will be at selected quality, cropped to 9:16.
        </p>

        <div className="space-y-2">
          <label className="text-sm text-muted-foreground">Download Quality</label>
          <div className="relative">
            <button
              onClick={() => setShowQualityMenu(!showQualityMenu)}
              className="w-full px-4 py-2 border border-dashed flex items-center justify-between hover:bg-muted"
            >
              <span>{currentLabel}</span>
              <ChevronDown className="w-4 h-4" />
            </button>
            {showQualityMenu && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-background border border-dashed z-10">
                {qualityOptions.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => {
                      onQualityChange(opt.value);
                      setShowQualityMenu(false);
                    }}
                    className={`w-full px-4 py-2 text-left hover:bg-muted ${
                      quality === opt.value ? "bg-muted" : ""
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <button
        onClick={onDownload}
        disabled={isDownloading}
        className="w-full py-4 bg-foreground text-background font-medium flex items-center justify-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-50"
      >
        {isDownloading ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            Processing...
          </>
        ) : (
          <>
            <Download className="w-5 h-5" />
            Download Short
          </>
        )}
      </button>
    </div>
  );
}
