"use client";

import { useState, useRef, useEffect } from "react";

interface UrlInputProps {
  url: string;
  setUrl: (url: string) => void;
  setVideoInfo: (info: any) => void;
}

export function UrlInput({ url, setUrl, setVideoInfo }: UrlInputProps) {
  const [isValid, setIsValid] = useState<boolean | null>(null);
  const [pasteError, setPasteError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const platforms = [
    "youtube.com",
    "youtu.be",
    "vimeo.com",
    "tiktok.com",
    "instagram.com",
    "twitter.com",
    "facebook.com",
    "twitch.tv",
    "soundcloud.com",
    "pinterest.com",
  ];

  const validateUrl = (value: string) => {
    if (!value.trim()) {
      setIsValid(null);
      setVideoInfo(null);
      return;
    }

    try {
      new URL(value);
      const supported = platforms.some((platform) => value.includes(platform));
      setIsValid(supported);
      if (!supported) setVideoInfo(null);
    } catch {
      setIsValid(false);
      setVideoInfo(null);
    }
  };

  const handleChange = (value: string) => {
    setUrl(value);
    setPasteError(null);

    // Debounce validation to avoid excessive checks while typing
    const timeoutId = setTimeout(() => validateUrl(value), 300);
    return () => clearTimeout(timeoutId);
  };

  const handlePaste = async (fromButton = false) => {
    setPasteError(null);

    try {
      const text = await navigator.clipboard.readText();

      if (!text) {
        setPasteError("Clipboard is empty");
        return;
      }

      if (!text.startsWith("http")) {
        setPasteError("Please copy a valid URL starting with http");
        return;
      }

      handleChange(text);

      // Focus input after paste
      if (inputRef.current && fromButton) {
        inputRef.current.focus();
      }
    } catch (error) {
      console.error("Paste failed:", error);
      setPasteError("Unable to access clipboard. Try using Ctrl+V or Cmd+V");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Handle Ctrl+V / Cmd+V
    if ((e.ctrlKey || e.metaKey) && e.key === "v") {
      e.preventDefault();
      handlePaste();
    }
  };

  const handleFocus = () => {
    // Auto-paste if input is empty and clipboard might have a URL
    if (!url.trim()) {
      handlePaste();
    }
  };

  // Clear paste error after a few seconds
  useEffect(() => {
    if (pasteError) {
      const timer = setTimeout(() => setPasteError(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [pasteError]);

  return (
    <div className="border border-dashed overflow-hidden">
      <div className="p-3 border-b border-dashed bg-card">
        <span className="text-sm font-medium">video url</span>
      </div>

      <div className="p-4">
        <div className="relative">
          <input
            ref={inputRef}
            type="url"
            value={url}
            onChange={(e) => handleChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={handleFocus}
            placeholder="paste video url here... (Ctrl+V or click paste)"
            className={`w-full px-3 py-2 pr-20 border border-dashed bg-transparent focus:ring-0 focus:outline-none transition-colors ${
              isValid === false
                ? "border-red-500"
                : isValid === true
                ? "border-green-500"
                : "border-muted-foreground"
            }`}
          />

          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
            {isValid === true && <span className="text-green-500">✓</span>}
            {isValid === false && <span className="text-red-500">✗</span>}

            <button
              type="button"
              onClick={() => handlePaste(true)}
              className="px-2 py-1 text-xs border border-dashed hover:bg-muted transition-colors"
            >
              paste
            </button>
          </div>
        </div>

        {isValid === false && (
          <p className="mt-2 text-sm text-red-500">
            please enter a valid url from a supported platform
          </p>
        )}

        {pasteError && (
          <p className="mt-2 text-sm text-orange-500">{pasteError}</p>
        )}
      </div>
    </div>
  );
}
