"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2 } from "lucide-react";

export default function Home() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

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
  ];

  const isValidUrl = (url: string) => {
    try {
      new URL(url);
      return platforms.some((platform) => url.includes(platform));
    } catch {
      return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!url.trim()) {
      setError("Please enter a URL");
      return;
    }

    if (!isValidUrl(url)) {
      setError("Please enter a valid video URL");
      return;
    }

    setLoading(true);
    
    // Navigate to video page with URL as query param
    router.push(`/video?url=${encodeURIComponent(url)}`);
  };

  return (
    <main className="min-h-dvh flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-2xl mx-auto text-center space-y-8">
        <div className="space-y-4">
          <h1 className="text-4xl md:text-5xl font-bold">Video Downloader</h1>
          <p className="text-muted-foreground text-lg">
            Download videos from YouTube, TikTok, Instagram and more
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="Paste video URL here..."
              className="flex-1 px-4 py-3 border border-dashed bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-foreground/20"
              disabled={loading}
            />
            <button
              type="submit"
              disabled={loading || !url.trim()}
              className="px-6 py-3 bg-foreground text-background font-medium flex items-center justify-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  Continue
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </div>

          {error && (
            <p className="text-red-500 text-sm">{error}</p>
          )}
        </form>

        <div className="pt-8 border-t border-dashed">
          <p className="text-sm text-muted-foreground mb-4">Supported platforms</p>
          <div className="flex flex-wrap justify-center gap-3 text-sm">
            {["YouTube", "TikTok", "Instagram", "Twitter", "Facebook", "Vimeo", "Twitch"].map((platform) => (
              <span key={platform} className="px-3 py-1 border border-dashed text-muted-foreground">
                {platform}
              </span>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
