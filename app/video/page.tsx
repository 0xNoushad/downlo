"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Image, Scissors } from "lucide-react";
import { FormatSelector } from "../components/FormatSelector";
import { DownloadButton } from "../components/DownloadButton";
import { ClipSelector } from "../components/ClipSelector";
import { ThumbnailModal } from "../components/ThumbnailModal";

interface VideoInfo {
  thumbnail: string;
  title: string;
  duration: string;
  platform: string;
  fileSize?: string;
}

function VideoContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const url = searchParams.get("url") || "";

  const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null);
  const [selectedFormat, setSelectedFormat] = useState("best[height<=720]");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [showThumbnailModal, setShowThumbnailModal] = useState(false);

  useEffect(() => {
    if (!url) {
      router.push("/");
      return;
    }

    const fetchVideoInfo = async () => {
      setLoading(true);
      setError("");
      
      try {
        const response = await fetch("/api/video-info", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url }),
        });

        if (response.ok) {
          const info = await response.json();
          setVideoInfo(info);
        } else {
          const errorData = await response.json();
          setError(errorData.error || "Failed to fetch video info");
        }
      } catch (err) {
        setError("Failed to fetch video info");
      } finally {
        setLoading(false);
      }
    };

    fetchVideoInfo();
  }, [url, router]);

  // Get embed URL for video preview
  const getEmbedUrl = (videoUrl: string) => {
    try {
      if (videoUrl.includes("youtube.com") || videoUrl.includes("youtu.be")) {
        const videoId = videoUrl.includes("youtu.be")
          ? videoUrl.split("youtu.be/")[1]?.split("?")[0]
          : new URL(videoUrl).searchParams.get("v");
        return videoId ? `https://www.youtube.com/embed/${videoId}` : null;
      }

      if (videoUrl.includes("vimeo.com")) {
        const videoId = videoUrl.split("vimeo.com/")[1]?.split("?")[0];
        return videoId ? `https://player.vimeo.com/video/${videoId}` : null;
      }

      return null;
    } catch {
      return null;
    }
  };

  const embedUrl = getEmbedUrl(url);

  if (loading) {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="w-10 h-10 animate-spin mx-auto" />
          <p className="text-muted-foreground">Loading video info...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-dvh flex items-center justify-center p-4">
        <div className="text-center space-y-4 max-w-md">
          <div className="text-6xl">😕</div>
          <h2 className="text-xl font-medium">Something went wrong</h2>
          <p className="text-muted-foreground">{error}</p>
          <button
            onClick={() => router.push("/")}
            className="px-4 py-2 border border-dashed hover:bg-muted transition-colors"
          >
            Try another URL
          </button>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-dvh">
      {/* Back button */}
      <div className="border-b border-dashed">
        <div className="max-w-4xl mx-auto px-4 py-3">
          <button
            onClick={() => router.push("/")}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
        </div>
      </div>

      {/* Video Preview Section */}
      <div className="w-full bg-black">
        <div className="max-w-4xl mx-auto">
          {embedUrl ? (
            <div className="aspect-video">
              <iframe
                src={embedUrl}
                className="w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          ) : videoInfo?.thumbnail ? (
            <div 
              className="aspect-video cursor-pointer relative group"
              onClick={() => setShowThumbnailModal(true)}
            >
              <img
                src={videoInfo.thumbnail}
                alt={videoInfo.title}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <span className="text-white text-sm">Click to view thumbnail</span>
              </div>
            </div>
          ) : (
            <div className="aspect-video bg-muted flex items-center justify-center">
              <span className="text-muted-foreground">No preview available</span>
            </div>
          )}
        </div>
      </div>

      {/* Video Info & Controls */}
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Video Title & Info */}
        {videoInfo && (
          <div className="space-y-3">
            <h1 className="text-xl md:text-2xl font-medium">{videoInfo.title}</h1>
            <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
              <span>Duration: {videoInfo.duration}</span>
              {videoInfo.platform && <span>• {videoInfo.platform}</span>}
              {(startTime || endTime) && (
                <span className="text-blue-400">• ✂️ Clip mode</span>
              )}
            </div>
            {/* Action Buttons */}
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => setShowThumbnailModal(true)}
                className="flex items-center gap-2 px-3 py-2 text-sm border border-dashed hover:bg-muted transition-colors"
              >
                <Image className="w-4 h-4" />
                Download Thumbnail
              </button>
              <button
                onClick={() => router.push(`/shorts?url=${encodeURIComponent(url)}`)}
                className="flex items-center gap-2 px-3 py-2 text-sm border border-dashed hover:bg-muted transition-colors"
              >
                <Scissors className="w-4 h-4" />
                Generate Shorts
              </button>
            </div>
          </div>
        )}

        {/* Clip Selector */}
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

        {/* Format Selector */}
        {videoInfo && (
          <FormatSelector
            selected={selectedFormat}
            onChange={setSelectedFormat}
          />
        )}

        {/* Download Button */}
        {videoInfo && (
          <DownloadButton
            url={url}
            format={selectedFormat}
            startTime={startTime}
            endTime={endTime}
          />
        )}
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

export default function VideoPage() {
  return (
    <Suspense fallback={
      <div className="min-h-dvh flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin" />
      </div>
    }>
      <VideoContent />
    </Suspense>
  );
}
