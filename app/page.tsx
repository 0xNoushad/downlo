"use client";

import { useState, useEffect } from "react";
import { UrlInput } from "./components/UrlInput";
import { FormatSelector } from "./components/FormatSelector";
import { DownloadButton } from "./components/DownloadButton";
import { ClipSelector } from "./components/ClipSelector";
import { ThumbnailModal } from "./components/ThumbnailModal";

export interface VideoInfo {
  thumbnail: string;
  title: string;
  duration: string;
  platform: string;
  fileSize?: string;
}

export default function VideoDownloader() {
  const [url, setUrl] = useState("");
  const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null);
  const [selectedFormat, setSelectedFormat] = useState("best[height<=720]");
  const [loading, setLoading] = useState(false);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [showThumbnailModal, setShowThumbnailModal] = useState(false);

  // Fetch video info when URL changes
  useEffect(() => {
    if (!url || !isValidUrl(url)) {
      setVideoInfo(null);
      return;
    }

    const timeoutId = setTimeout(async () => {
      setLoading(true);
      try {
        const response = await fetch("/api/video-info", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url }),
        });

        if (response.ok) {
          const info = await response.json();
          setVideoInfo(info);
          // Reset clip settings when new video is loaded
          setStartTime("");
          setEndTime("");
        } else {
          const error = await response.json();
          console.error("Failed to fetch video info:", error);
          setVideoInfo(null);
        }
      } catch (error) {
        console.error("Error fetching video info:", error);
        setVideoInfo(null);
      } finally {
        setLoading(false);
      }
    }, 1000); // Debounce for 1 second

    return () => clearTimeout(timeoutId);
  }, [url]);

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

  return (
    <main className="min-h-dvh flex flex-col h-full w-full">
      <div className="flex flex-col mx-auto w-full h-full">
        <div className="flex flex-col mx-auto w-full border-dashed h-full">
          <div className="flex flex-col gap-4 w-full border-x border-dashed max-w-4xl mx-auto h-full min-h-dvh">
            <div className="relative flex flex-col h-full">
              <div className="flex flex-col">
                
                <div className="p-4 lg:p-6 space-y-6">
                  <UrlInput
                    url={url}
                    setUrl={setUrl}
                    setVideoInfo={setVideoInfo}
                    loading={loading}
                  />

                  {videoInfo && (
                    <div className="border border-dashed overflow-hidden">
                      <div className="flex flex-col">
                        {videoInfo.thumbnail && (
                          <div className="w-full aspect-video border-b border-dashed cursor-pointer hover:opacity-80 transition-opacity">
                            <img
                              src={videoInfo.thumbnail}
                              alt={videoInfo.title}
                              className="w-full h-full object-cover"
                              onClick={() => setShowThumbnailModal(true)}
                            />
                          </div>
                        )}
                        <div className="p-4">
                          <h2 className="font-medium mb-2">
                            {videoInfo.title}
                          </h2>
                          <div className="text-sm text-muted-foreground space-y-1">
                            <p>Duration: {videoInfo.duration}</p>
                            {videoInfo.platform && (
                              <p>Platform: {videoInfo.platform}</p>
                            )}
                            {(startTime || endTime) && (
                              <p className="text-blue-400">✂️ Clip mode enabled</p>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {videoInfo && (
                    <ClipSelector
                      duration={videoInfo.duration}
                      startTime={startTime}
                      endTime={endTime}
                      onStartTimeChange={setStartTime}
                      onEndTimeChange={setEndTime}
                      onReset={() => {
                        setStartTime("");
                        setEndTime("");
                      }}
                    />
                  )}

                  {videoInfo && (
                    <FormatSelector
                      selected={selectedFormat}
                      onChange={setSelectedFormat}
                    />
                  )}

                  {videoInfo && (
                    <DownloadButton
                      url={url}
                      format={selectedFormat}
                      startTime={startTime}
                      endTime={endTime}
                    />
                  )}

                  {!videoInfo && !loading && (
                    <div className="text-center py-16 text-muted-foreground">
                      <div className="text-6xl mb-4">🎬</div>
                      <h3 className="text-lg font-medium mb-2">
                        paste video url to start
                      </h3>
                      <p className="text-sm">
                        supports youtube, tiktok, instagram and more
                      </p>
                    </div>
                  )}

                  {loading && (
                    <div className="text-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-foreground mx-auto mb-2"></div>
                      <p className="text-muted-foreground text-sm">loading video info...</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Thumbnail Modal */}
      {videoInfo && (
        <ThumbnailModal
          isOpen={showThumbnailModal}
          onClose={() => setShowThumbnailModal(false)}
          thumbnail={videoInfo.thumbnail}
          title={videoInfo.title}
          videoUrl={url}
        />
      )}
    </main>
  );
}
