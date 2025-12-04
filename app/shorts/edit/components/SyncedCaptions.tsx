"use client";

import { motion, AnimatePresence } from "framer-motion";

export interface TranscriptSegment {
  start: number;
  end: number;
  text: string;
}

export interface CaptionStyleConfig {
  fontFamily: string;
  fontSize: number;
  fontWeight: "normal" | "bold";
  color: string;
  backgroundColor: string;
  position: "top" | "middle" | "bottom";
  maxWords: number;
}

interface SyncedCaptionsProps {
  segments: TranscriptSegment[];
  currentTime: number;
  style: CaptionStyleConfig;
}

// Decode HTML entities
function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&gt;/g, ">")
    .replace(/&lt;/g, "<")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, "/")
    .replace(/&nbsp;/g, " ");
}

// Chunk a segment's text by word count and calculate timing
function getChunkedCaption(
  segment: TranscriptSegment,
  currentTime: number,
  maxWords: number
): string | null {
  const cleanText = decodeHtmlEntities(segment.text).trim();
  if (!cleanText) return null;
  
  const words = cleanText.split(/\s+/).filter(w => w.length > 0);
  if (words.length === 0) return null;
  
  // If within limit, return full text
  if (words.length <= maxWords) return cleanText;
  
  // Calculate which chunk we're in based on time
  const segDuration = segment.end - segment.start;
  const timePerWord = segDuration / words.length;
  const timeIntoSegment = currentTime - segment.start;
  const wordIndex = Math.floor(timeIntoSegment / timePerWord);
  const chunkIndex = Math.floor(wordIndex / maxWords);
  const startWord = chunkIndex * maxWords;
  
  return words.slice(startWord, startWord + maxWords).join(" ");
}

export function SyncedCaptions({ segments, currentTime, style }: SyncedCaptionsProps) {
  // Both currentTime and segments are relative to clip (start from 0)
  // No conversion needed!
  
  // Find the current segment based on current time
  const currentSegment = segments.find(
    (seg) => currentTime >= seg.start && currentTime < seg.end
  );
  
  // Get the chunked caption text
  const captionText = currentSegment 
    ? getChunkedCaption(currentSegment, currentTime, style.maxWords)
    : null;

  const positionStyles = {
    top: "top-8",
    middle: "top-1/2 -translate-y-1/2",
    bottom: "bottom-12",
  };

  return (
    <div className={`absolute left-0 right-0 px-3 pointer-events-none z-20 ${positionStyles[style.position]}`}>
      <AnimatePresence mode="wait">
        {captionText && (
          <motion.div
            key={`${currentSegment?.start}-${captionText}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.15 }}
            className="text-center"
          >
            <span
              style={{
                fontFamily: style.fontFamily,
                fontSize: `${style.fontSize}px`,
                fontWeight: style.fontWeight,
                color: style.color,
                backgroundColor: style.backgroundColor !== "transparent" ? style.backgroundColor : "rgba(0,0,0,0.7)",
                padding: "6px 14px",
                borderRadius: "6px",
                display: "inline-block",
                maxWidth: "90%",
                lineHeight: 1.3,
                textShadow: "1px 1px 2px rgba(0,0,0,0.5)",
              }}
            >
              {captionText}
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export const defaultCaptionStyle: CaptionStyleConfig = {
  fontFamily: "Inter",
  fontSize: 18,
  fontWeight: "bold",
  color: "#FFFFFF",
  backgroundColor: "transparent",
  position: "bottom",
  maxWords: 5,
};
