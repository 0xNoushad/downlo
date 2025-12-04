"use client";

import { Type, Bold } from "lucide-react";
import { ColorPicker } from "@/components/ui/color-picker";
import type { CaptionStyleConfig } from "./SyncedCaptions";

interface CaptionStyleEditorProps {
  style: CaptionStyleConfig;
  onChange: (style: CaptionStyleConfig) => void;
  showCaptions: boolean;
  onToggleCaptions: (show: boolean) => void;
}

const FONT_OPTIONS = [
  { value: "Inter", label: "Inter" },
  { value: "Arial Black", label: "Impact" },
  { value: "Georgia", label: "Georgia" },
  { value: "Courier New", label: "Mono" },
];

export function CaptionStyleEditor({ style, onChange, showCaptions, onToggleCaptions }: CaptionStyleEditorProps) {
  const update = (updates: Partial<CaptionStyleConfig>) => {
    onChange({ ...style, ...updates });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Type className="w-4 h-4" />
          <span className="text-sm font-medium">Auto Captions</span>
        </div>
        <button
          onClick={() => onToggleCaptions(!showCaptions)}
          className={`px-3 py-1 text-xs font-medium border border-dashed rounded-md transition-colors ${
            showCaptions ? "bg-foreground text-background" : "hover:bg-muted"
          }`}
        >
          {showCaptions ? "On" : "Off"}
        </button>
      </div>

      <p className="text-xs text-muted-foreground">
        Edit transcript below • Style captions here
      </p>

      {/* Font & Size */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Font</label>
          <select
            value={style.fontFamily}
            onChange={(e) => update({ fontFamily: e.target.value })}
            className="w-full px-2 py-1.5 text-sm border border-dashed rounded-md bg-background"
          >
            {FONT_OPTIONS.map((font) => (
              <option key={font.value} value={font.value}>{font.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Size</label>
          <input
            type="range"
            min="14"
            max="32"
            value={style.fontSize}
            onChange={(e) => update({ fontSize: Number(e.target.value) })}
            className="w-full"
          />
          <span className="text-xs text-muted-foreground">{style.fontSize}px</span>
        </div>
      </div>

      {/* Bold toggle */}
      <div>
        <label className="text-xs text-muted-foreground mb-1 block">Weight</label>
        <button
          onClick={() => update({ fontWeight: style.fontWeight === "bold" ? "normal" : "bold" })}
          className={`p-2 border border-dashed rounded-md ${style.fontWeight === "bold" ? "bg-foreground text-background" : ""}`}
        >
          <Bold className="w-4 h-4" />
        </button>
      </div>

      {/* Colors */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Text Color</label>
          <ColorPicker color={style.color} onChange={(color) => update({ color })} />
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Background</label>
          <ColorPicker color={style.backgroundColor} onChange={(color) => update({ backgroundColor: color })} />
        </div>
      </div>

      {/* Position */}
      <div>
        <label className="text-xs text-muted-foreground mb-1 block">Position</label>
        <div className="flex gap-1">
          {(["top", "middle", "bottom"] as const).map((pos) => (
            <button
              key={pos}
              onClick={() => update({ position: pos })}
              className={`flex-1 py-1.5 text-xs border border-dashed rounded-md capitalize ${
                style.position === pos ? "bg-foreground text-background" : ""
              }`}
            >
              {pos}
            </button>
          ))}
        </div>
      </div>

      {/* Words per caption */}
      <div>
        <label className="text-xs text-muted-foreground mb-1 block">
          Words per caption: {style.maxWords}
        </label>
        <input
          type="range"
          min="2"
          max="10"
          value={style.maxWords}
          onChange={(e) => update({ maxWords: Number(e.target.value) })}
          className="w-full"
        />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>2</span>
          <span>10</span>
        </div>
      </div>
    </div>
  );
}
