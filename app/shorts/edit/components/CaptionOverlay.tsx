"use client";

import { motion } from "framer-motion";
import type { CaptionStyle } from "./CaptionEditor";

interface CaptionOverlayProps {
  caption: CaptionStyle;
  isVisible: boolean;
}

const animations = {
  none: {
    initial: {},
    animate: {},
  },
  fade: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
  },
  slide: {
    initial: { y: 20, opacity: 0 },
    animate: { y: 0, opacity: 1 },
  },
  pop: {
    initial: { scale: 0.5, opacity: 0 },
    animate: { scale: 1, opacity: 1 },
  },
  typewriter: {
    initial: { width: 0 },
    animate: { width: "auto" },
  },
};

export function CaptionOverlay({ caption, isVisible }: CaptionOverlayProps) {
  if (!caption.text || !isVisible) return null;

  const positionStyles = {
    top: "top-8",
    middle: "top-1/2 -translate-y-1/2",
    bottom: "bottom-8",
  };

  const anim = animations[caption.animation] || animations.none;

  return (
    <div
      className={`absolute left-0 right-0 px-4 pointer-events-none z-20 ${positionStyles[caption.position]}`}
    >
      <motion.div
        initial={anim.initial}
        animate={anim.animate}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="overflow-hidden"
        style={{
          textAlign: caption.textAlign,
        }}
      >
        <span
          style={{
            fontFamily: caption.fontFamily,
            fontSize: `${caption.fontSize}px`,
            fontWeight: caption.fontWeight,
            fontStyle: caption.fontStyle,
            color: caption.color,
            backgroundColor: caption.backgroundColor !== "transparent" ? caption.backgroundColor : undefined,
            padding: caption.backgroundColor !== "transparent" ? "4px 12px" : undefined,
            borderRadius: caption.backgroundColor !== "transparent" ? "4px" : undefined,
            display: "inline-block",
            textShadow: caption.backgroundColor === "transparent" ? "2px 2px 4px rgba(0,0,0,0.8)" : undefined,
          }}
        >
          {caption.text}
        </span>
      </motion.div>
    </div>
  );
}
