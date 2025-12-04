"use client";

import React, { useState, useRef, useEffect } from "react";
import { Check, ChevronDown } from "lucide-react";

const hexToHsl = (hex: string): [number, number, number] => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return [0, 0, 0];
  const r = parseInt(result[1], 16) / 255;
  const g = parseInt(result[2], 16) / 255;
  const b = parseInt(result[3], 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
};

interface ColorPickerProps {
  color: string;
  onChange: (color: string) => void;
}

export function ColorPicker({ color, onChange }: ColorPickerProps) {
  const [hsl, setHsl] = useState<[number, number, number]>(() => {
    if (color.startsWith("#")) return hexToHsl(color);
    return [0, 100, 50];
  });
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const presets = [
    "#FFFFFF", "#000000", "#FF3B30", "#FF9500", 
    "#FFCC00", "#4CD964", "#5AC8FA", "#007AFF",
    "#5856D6", "#FF2D55", "#8E8E93", "#34C759",
  ];

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);


  const handleHueChange = (hue: number) => {
    const newHsl: [number, number, number] = [hue, hsl[1], hsl[2]];
    setHsl(newHsl);
    onChange(`hsl(${newHsl[0]}, ${newHsl[1]}%, ${newHsl[2]}%)`);
  };

  const handleSLChange = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
    const y = Math.max(0, Math.min(rect.height, e.clientY - rect.top));
    const s = Math.round((x / rect.width) * 100);
    const l = Math.round(100 - (y / rect.height) * 100);
    const newHsl: [number, number, number] = [hsl[0], s, l];
    setHsl(newHsl);
    onChange(`hsl(${newHsl[0]}, ${newHsl[1]}%, ${newHsl[2]}%)`);
  };

  const handlePresetClick = (preset: string) => {
    const [h, s, l] = hexToHsl(preset);
    setHsl([h, s, l]);
    onChange(preset);
    setIsOpen(false);
  };

  const currentColor = `hsl(${hsl[0]}, ${hsl[1]}%, ${hsl[2]}%)`;
  const displayColor = color.startsWith("#") ? color : currentColor;

  return (
    <div ref={containerRef} className="relative">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-2 px-3 py-2 text-sm border border-dashed rounded-md bg-background hover:bg-muted transition-colors"
      >
        <div className="w-5 h-5 rounded border shrink-0" style={{ backgroundColor: displayColor }} />
        <span className="text-xs truncate flex-1 text-left">{displayColor}</span>
        <ChevronDown className={`h-4 w-4 opacity-50 shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 p-3 bg-background border border-dashed rounded-md shadow-lg z-50 space-y-3">
          <div
            className="w-full h-28 rounded-lg cursor-crosshair relative overflow-hidden"
            style={{
              background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, transparent), hsl(${hsl[0]}, 100%, 50%)`,
            }}
            onClick={handleSLChange}
          >
            <div
              className="w-4 h-4 rounded-full border-2 border-white absolute shadow-md pointer-events-none"
              style={{ left: `calc(${hsl[1]}% - 8px)`, top: `calc(${100 - hsl[2]}% - 8px)`, backgroundColor: currentColor }}
            />
          </div>
          
          <input
            type="range"
            min="0"
            max="360"
            value={hsl[0]}
            onChange={(e) => handleHueChange(Number(e.target.value))}
            className="w-full h-2 rounded-full appearance-none cursor-pointer"
            style={{
              background: `linear-gradient(to right, hsl(0, 100%, 50%), hsl(60, 100%, 50%), hsl(120, 100%, 50%), hsl(180, 100%, 50%), hsl(240, 100%, 50%), hsl(300, 100%, 50%), hsl(360, 100%, 50%))`,
            }}
          />

          <div className="grid grid-cols-6 gap-1.5">
            {presets.map((preset) => (
              <button
                key={preset}
                className="w-6 h-6 rounded-full relative border border-border hover:scale-110 transition-transform"
                style={{ backgroundColor: preset }}
                onClick={() => handlePresetClick(preset)}
              >
                {color === preset && <Check className="w-3 h-3 text-white absolute inset-0 m-auto drop-shadow-md" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
