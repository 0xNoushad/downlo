"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { ArrowLeft, Loader2 } from "lucide-react";
import { VideoPlayer, TrimControls, ExportSettings, ProgressBar } from "./components";

function EditContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const videoUrl = searchParams.get("video") || "";
  const sourceUrl = searchParams.get("source") || "";
  const startParam = parseFloat(searchParams.get("start") || "0");
  const endParam = parseFloat(searchParams.get("end") || "60");
  const titleParam = searchParams.get("title") || "Short Clip";

  const videoRef = useRef<HTMLVideoElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [startTime, setStartTime] = useState(startParam);
  const [endTime, setEndTime] = useState(endParam);
  const [videoDuration, setVideoDuration] = useState(endParam - startParam);
  const [isMuted, setIsMuted] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isDownloading, setIsDownloading] = useState(false);
  const [quality, setQuality] = useState<"720" | "1080" | "best">("1080");

  useEffect(() => {
    if (!videoUrl) {
      router.push("/shorts/select");
    }
  }, [videoUrl, router]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime);
    };

    const handleLoadedMetadata = () => {
      setVideoDuration(video.duration);
      setIsLoading(false);
    };

    const handleCanPlay = () => setIsLoading(false);

    video.addEventListener("timeupdate", handleTimeUpdate);
    video.addEventListener("loadedmetadata", handleLoadedMetadata);
    video.addEventListener("canplay", handleCanPlay);

    return () => {
      video.removeEventListener("timeupdate", handleTimeUpdate);
      video.removeEventListener("loadedmetadata", handleLoadedMetadata);
      video.removeEventListener("canplay", handleCanPlay);
    };
  }, []);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;

    if (isMuted) {
      video.muted = false;
      setIsMuted(false);
    }

    if (video.paused) {
      video.play();
    } else {
      video.pause();
    }
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = progressRef.current?.getBoundingClientRect();
    if (!rect || !videoRef.current) return;

    const clickX = e.clientX - rect.left;
    const percentage = clickX / rect.width;
    const newTime = videoDuration * percentage;
    
    videoRef.current.currentTime = Math.max(0, Math.min(videoDuration, newTime));
  };

  const adjustTrim = (type: "start" | "end", delta: number) => {
    if (type === "start") {
      const newStart = Math.max(0, startTime + delta);
      if (newStart < endTime - 5) {
        setStartTime(newStart);
      }
    } else {
      const newEnd = endTime + delta;
      if (newEnd > startTime + 5) {
        setEndTime(newEnd);
      }
    }
  };

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      let downloadUrl = sourceUrl || videoUrl;
      try {
        while (downloadUrl.includes("%")) {
          const decoded = decodeURIComponent(downloadUrl);
          if (decoded === downloadUrl) break;
          downloadUrl = decoded;
        }
      } catch {}
      
      const params = new URLSearchParams({
        url: downloadUrl,
        start: startTime.toString(),
        end: endTime.toString(),
        quality: quality,
      });

      const response = await fetch(`/api/shorts/download?${params}`);
      
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${titleParam.replace(/[^a-z0-9]/gi, "_")}_short.mp4`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      } else {
        const error = await response.json();
        alert(error.error || "Download failed");
      }
    } catch (error) {
      console.error("Download error:", error);
      alert("Download failed");
    } finally {
      setIsDownloading(false);
    }
  };

  const decodedVideoUrl = decodeURIComponent(videoUrl);

  return (
    <main className="min-h-dvh bg-background">
      <header className="border-b border-dashed sticky top-0 bg-background z-10">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-4">
          <button
            onClick={() => router.push("/shorts/select")}
            className="p-2 hover:bg-muted transition-colors border border-dashed"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="font-medium">Edit Short</h1>
            <p className="text-xs text-muted-foreground truncate">{titleParam}</p>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="grid lg:grid-cols-[1fr,320px] gap-8">
          <div className="space-y-4">
            <VideoPlayer
              ref={videoRef}
              videoUrl={decodedVideoUrl}
              isPlaying={isPlaying}
              isLoading={isLoading}
              isMuted={isMuted}
              onTogglePlay={togglePlay}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
            />
            <ProgressBar
              ref={progressRef}
              currentTime={currentTime}
              duration={videoDuration}
              onSeek={handleSeek}
            />
          </div>

          <div className="space-y-6">
            <TrimControls
              startTime={startTime}
              endTime={endTime}
              onAdjustStart={(delta) => adjustTrim("start", delta)}
              onAdjustEnd={(delta) => adjustTrim("end", delta)}
            />
            <ExportSettings
              quality={quality}
              onQualityChange={setQuality}
              isDownloading={isDownloading}
              onDownload={handleDownload}
            />
          </div>
        </div>
      </div>
    </main>
  );
}

export default function EditPage() {
  return (
    <Suspense fallback={<div className="min-h-dvh flex items-center justify-center"><Loader2 className="w-10 h-10 animate-spin" /></div>}>
      <EditContent />
    </Suspense>
  );
}
