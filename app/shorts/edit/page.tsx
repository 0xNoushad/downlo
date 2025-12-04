"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Scissors, Type, Settings } from "lucide-react";
import { 
  VideoPlayer, 
  TrimControls, 
  ExportSettings, 
  ProgressBar,
  CaptionEditor,
  CaptionStyleEditor,
  SyncedCaptions,
  TranscriptViewer,
  defaultCaptionStyle,
  type CaptionStyle,
  type TranscriptSegment,
  type CaptionStyleConfig,
} from "./components";

type EditTab = "trim" | "captions" | "export";

const getDefaultCaption = (text: string): CaptionStyle => ({
  text,
  fontFamily: "Inter",
  fontSize: 24,
  fontWeight: "bold",
  fontStyle: "normal",
  textAlign: "center",
  color: "#FFFFFF",
  backgroundColor: "transparent",
  position: "bottom",
  animation: "fade",
});

function EditContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const streamUrl = searchParams.get("video") || "";
  const sourceUrl = searchParams.get("source") || "";
  const startParam = parseFloat(searchParams.get("start") || "0");
  const endParam = parseFloat(searchParams.get("end") || "60");
  const titleParam = searchParams.get("title") || "Short Clip";
  const transcriptParam = searchParams.get("transcript") || "";
  
  // Use the stream URL directly (same as select page) for audio support
  const previewUrl = streamUrl;

  const videoRef = useRef<HTMLVideoElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);

  const [activeTab, setActiveTab] = useState<EditTab>("trim");
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [startTime, setStartTime] = useState(startParam);
  const [endTime, setEndTime] = useState(endParam);
  const [videoDuration, setVideoDuration] = useState(endParam - startParam);
  const [isMuted, setIsMuted] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isDownloading, setIsDownloading] = useState(false);
  const [quality, setQuality] = useState<"720" | "1080" | "best">("1080");
  const [caption, setCaption] = useState<CaptionStyle>(() => getDefaultCaption(transcriptParam));
  const [segments, setSegments] = useState<TranscriptSegment[]>([]);
  const [captionStyle, setCaptionStyle] = useState<CaptionStyleConfig>(defaultCaptionStyle);
  const [showCaptions, setShowCaptions] = useState(true);

  // Load segments from sessionStorage
  useEffect(() => {
    const savedSegments = sessionStorage.getItem("edit_segments");
    if (savedSegments) {
      try {
        setSegments(JSON.parse(savedSegments));
      } catch {}
    }
  }, []);

  useEffect(() => {
    if (!sourceUrl) {
      router.push("/shorts/select");
    }
  }, [sourceUrl, router]);


  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const clipDuration = endParam - startParam;

    const handleTimeUpdate = () => {
      // Calculate relative time within the clip
      const relativeTime = video.currentTime - startParam;
      setCurrentTime(Math.max(0, relativeTime));
      
      // Loop back to start if we've passed the end
      if (video.currentTime >= endParam) {
        video.currentTime = startParam;
      }
    };
    
    const handleLoadedMetadata = () => {
      setVideoDuration(clipDuration);
      video.currentTime = startParam;
      setIsLoading(false);
    };
    
    const handleCanPlay = () => {
      setIsLoading(false);
    };

    video.addEventListener("timeupdate", handleTimeUpdate);
    video.addEventListener("loadedmetadata", handleLoadedMetadata);
    video.addEventListener("canplay", handleCanPlay);

    return () => {
      video.removeEventListener("timeupdate", handleTimeUpdate);
      video.removeEventListener("loadedmetadata", handleLoadedMetadata);
      video.removeEventListener("canplay", handleCanPlay);
    };
  }, [startParam, endParam]);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;

    // Unmute on first interaction
    if (video.muted) {
      video.muted = false;
      setIsMuted(false);
    }

    if (video.paused) {
      video.play().catch(console.error);
    } else {
      video.pause();
    }
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    
    video.muted = !video.muted;
    setIsMuted(video.muted);
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = progressRef.current?.getBoundingClientRect();
    if (!rect || !videoRef.current) return;

    const clickX = e.clientX - rect.left;
    const percentage = clickX / rect.width;
    // Convert relative time to absolute video time
    const newTime = startParam + (videoDuration * percentage);
    videoRef.current.currentTime = Math.max(startParam, Math.min(endParam, newTime));
  };

  const adjustTrim = (type: "start" | "end", delta: number) => {
    if (type === "start") {
      const newStart = Math.max(0, startTime + delta);
      if (newStart < endTime - 5) setStartTime(newStart);
    } else {
      const newEnd = endTime + delta;
      if (newEnd > startTime + 5) setEndTime(newEnd);
    }
  };

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      let downloadUrl = sourceUrl;
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

      // Add segments and caption style for subtitle burning (only if captions are enabled)
      if (showCaptions && segments.length > 0) {
        params.set("segments", encodeURIComponent(JSON.stringify(segments)));
        params.set("captionStyle", encodeURIComponent(JSON.stringify(captionStyle)));
      } else if (caption.text) {
        params.set("caption", JSON.stringify(caption));
      }

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

  // Preview URL is already properly formatted

  const tabs = [
    { id: "trim" as const, label: "Trim", icon: Scissors },
    { id: "captions" as const, label: "Captions", icon: Type },
    { id: "export" as const, label: "Export", icon: Settings },
  ];


  return (
    <main className="min-h-dvh bg-background">
      <header className="border-b border-dashed sticky top-0 bg-background z-10">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-4">
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

      <div className="max-w-5xl mx-auto px-4 py-6">
        <div className="grid lg:grid-cols-[1fr,360px] gap-8">
          <div className="space-y-4">
            <VideoPlayer
              ref={videoRef}
              videoUrl={previewUrl}
              isPlaying={isPlaying}
              isLoading={isLoading}
              isMuted={isMuted}
              onTogglePlay={togglePlay}
              onToggleMute={toggleMute}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
            >
              {showCaptions && (
                segments.length > 0 ? (
                  <SyncedCaptions
                    segments={segments}
                    currentTime={currentTime}
                    style={captionStyle}
                  />
                ) : (
                  caption.text && (
                    <div className={`absolute left-0 right-0 px-3 pointer-events-none z-20 ${
                      caption.position === "top" ? "top-8" : caption.position === "middle" ? "top-1/2 -translate-y-1/2" : "bottom-12"
                    }`}>
                      <div className="text-center">
                        <span
                          style={{
                            fontFamily: caption.fontFamily,
                            fontSize: `${caption.fontSize}px`,
                            fontWeight: caption.fontWeight,
                            color: caption.color,
                            backgroundColor: caption.backgroundColor !== "transparent" ? caption.backgroundColor : "rgba(0,0,0,0.7)",
                            padding: "6px 14px",
                            borderRadius: "6px",
                            display: "inline-block",
                          }}
                        >
                          {caption.text}
                        </span>
                      </div>
                    </div>
                  )
                )
              )}
            </VideoPlayer>
            <ProgressBar
              ref={progressRef}
              currentTime={currentTime}
              duration={videoDuration}
              onSeek={handleSeek}
            />
          </div>

          <div className="space-y-4">
            <div className="flex border border-dashed rounded-md overflow-hidden">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-1 py-2.5 px-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
                    activeTab === tab.id 
                      ? "bg-foreground text-background" 
                      : "hover:bg-muted"
                  }`}
                >
                  <tab.icon className="w-4 h-4" />
                  <span className="hidden sm:inline">{tab.label}</span>
                </button>
              ))}
            </div>

            <div className="border border-dashed rounded-md p-4">
              {activeTab === "trim" && (
                <TrimControls
                  startTime={startTime}
                  endTime={endTime}
                  onAdjustStart={(delta) => adjustTrim("start", delta)}
                  onAdjustEnd={(delta) => adjustTrim("end", delta)}
                />
              )}
              {activeTab === "captions" && (
                segments.length > 0 ? (
                  <CaptionStyleEditor 
                    style={captionStyle} 
                    onChange={setCaptionStyle}
                    showCaptions={showCaptions}
                    onToggleCaptions={setShowCaptions}
                  />
                ) : (
                  <CaptionEditor caption={caption} onChange={setCaption} />
                )
              )}
              {activeTab === "export" && (
                <ExportSettings
                  quality={quality}
                  onQualityChange={setQuality}
                  isDownloading={isDownloading}
                  onDownload={handleDownload}
                />
              )}
            </div>

            {/* Live Transcript Viewer */}
            {segments.length > 0 && (
              <div className="border border-dashed rounded-md h-64 overflow-hidden">
                <TranscriptViewer
                  segments={segments}
                  currentTime={currentTime}
                  onSegmentClick={(time) => {
                    if (videoRef.current) {
                      videoRef.current.currentTime = startParam + time;
                    }
                  }}
                  onSegmentEdit={(index, text) => {
                    const updated = [...segments];
                    updated[index] = { ...updated[index], text };
                    setSegments(updated);
                  }}
                />
              </div>
            )}
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
