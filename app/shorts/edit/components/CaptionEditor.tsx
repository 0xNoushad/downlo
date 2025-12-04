"use client";

import { useState } from "react";
import { Type, AlignLeft, AlignCenter, AlignRight, Bold, Italic } from "lucide-react";
import { ColorPicker } from "@/components/ui/color-picker";

export interface CaptionStyle {
  text: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: "normal" | "bold";
  fontStyle: "normal" | "italic";
  textAlign: "left" | "center" | "right";
  color: string;
  backgroundColor: string;
  position: "top" | "middle" | "bottom";
  animation: "none" | "fade" | "slide" | "pop" | "typewriter";
}

interface CaptionEditorProps {
  caption: CaptionStyle;
  onChange: (caption: CaptionStyle) => void;
}

const FONT_OPTIONS = [
  { value: "Inter", label: "Inter" },
  { value: "Arial Black", label: "Impact" },
  { value: "Georgia", label: "Georgia" },
  { value: "Courier New", label: "Mono" },
  { value: "Comic Sans MS", label: "Comic" },
];

const ANIMATION_OPTIONS = [
  { value: "none", label: "None" },
  { value: "fade", label: "Fade In" },
  { value: "slide", label: "Slide Up" },
  { value: "pop", label: "Pop" },
  { value: "typewriter", label: "Typewriter" },
];

export function CaptionEditor({ caption, onChange }: CaptionEditorProps) {
  const update = (updates: Partial<CaptionStyle>) => {
    onChange({ ...caption, ...updates });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Type className="w-4 h-4" />
        <span className="text-sm font-medium">Caption Style</span>
      </div>

      {/* Caption Text */}
      <div>
        <label className="text-xs text-muted-foreground mb-1 block">Text</label>
        <textarea
          value={caption.text}
          onChange={(e) => update({ text: e.target.value })}
          placeholder="Enter caption text..."
          className="w-full px-3 py-2 text-sm border border-dashed rounded-md bg-background resize-none h-20"
        />
      </div>

      {/* Font Family & Size */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Font</label>
          <select
            value={caption.fontFamily}
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
            min="12"
            max="48"
            value={caption.fontSize}
            onChange={(e) => update({ fontSize: Number(e.target.value) })}
            className="w-full"
          />
          <span className="text-xs text-muted-foreground">{caption.fontSize}px</span>
        </div>
      </div>

      {/* Text Style Buttons */}
      <div className="flex gap-1">
        <button
          onClick={() => update({ fontWeight: caption.fontWeight === "bold" ? "normal" : "bold" })}
          className={`p-2 border border-dashed rounded-md ${caption.fontWeight === "bold" ? "bg-foreground text-background" : ""}`}
        >
          <Bold className="w-4 h-4" />
        </button>
        <button
          onClick={() => update({ fontStyle: caption.fontStyle === "italic" ? "normal" : "italic" })}
          className={`p-2 border border-dashed rounded-md ${caption.fontStyle === "italic" ? "bg-foreground text-background" : ""}`}
        >
          <Italic className="w-4 h-4" />
        </button>
        <div className="w-px bg-border mx-1" />
        <button
          onClick={() => update({ textAlign: "left" })}
          className={`p-2 border border-dashed rounded-md ${caption.textAlign === "left" ? "bg-foreground text-background" : ""}`}
        >
          <AlignLeft className="w-4 h-4" />
        </button>
        <button
          onClick={() => update({ textAlign: "center" })}
          className={`p-2 border border-dashed rounded-md ${caption.textAlign === "center" ? "bg-foreground text-background" : ""}`}
        >
          <AlignCenter className="w-4 h-4" />
        </button>
        <button
          onClick={() => update({ textAlign: "right" })}
          className={`p-2 border border-dashed rounded-md ${caption.textAlign === "right" ? "bg-foreground text-background" : ""}`}
        >
          <AlignRight className="w-4 h-4" />
        </button>
      </div>

      {/* Colors */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Text Color</label>
          <ColorPicker color={caption.color} onChange={(color) => update({ color })} />
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Background</label>
          <ColorPicker color={caption.backgroundColor} onChange={(color) => update({ backgroundColor: color })} />
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
                caption.position === pos ? "bg-foreground text-background" : ""
              }`}
            >
              {pos}
            </button>
          ))}
        </div>
      </div>

      {/* Animation */}
      <div>
        <label className="text-xs text-muted-foreground mb-1 block">Animation</label>
        <select
          value={caption.animation}
          onChange={(e) => update({ animation: e.target.value as CaptionStyle["animation"] })}
          className="w-full px-2 py-1.5 text-sm border border-dashed rounded-md bg-background"
        >
          {ANIMATION_OPTIONS.map((anim) => (
            <option key={anim.value} value={anim.value}>{anim.label}</option>
          ))}
        </select>
      </div>
    </div>
  );
}
