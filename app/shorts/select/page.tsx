"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2 } from "lucide-react";
import { ShortPreview, ShortsList, type IphoneHandle } from "./components";

interface Short {
  id: string;
  thumbnail: string;
  title: string;
  startTime: number;
  endTime: number;
  transcript: string;
  score: number;
}

interface VideoInfo {
  title: string;
  duration: number;
  thumbnail: string;
}

interface ShortsData {
  shorts: Short[];
  videoInfo: VideoInfo;
  streamUrl: string;
  sourceUrl: string;
}

export default function SelectPage() {
  const router = useRouter();
  const iphoneRef = useRef<IphoneHandle>(null);

  const [data, setData] = useState<ShortsData | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);

  const selectedShort = data?.shorts[selectedIndex] || null;

  useEffect(() => {
    const saved = sessionStorage.getItem("shorts_data");
    if (saved) {
      try {
        setData(JSON.parse(saved));
      } catch {
        router.push("/");
      }
    } else {
      router.push("/");
    }
  }, [router]);

  const handleTogglePlay = () => {
    iphoneRef.current?.toggle();
  };

  const handleShortClick = (index: number) => {
    setSelectedIndex(index);
    setIsPlaying(true);
  };

  const handleEditClick = () => {
    if (!selectedShort || !data) return;
    
    const params = new URLSearchParams({
      video: data.streamUrl,
      source: data.sourceUrl,
      start: selectedShort.startTime.toString(),
      end: selectedShort.endTime.toString(),
      title: selectedShort.title,
    });
    
    router.push(`/shorts/edit?${params}`);
  };

  if (!data) {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin" />
      </div>
    );
  }

  return (
    <main className="min-h-dvh bg-background">
      <header className="border-b border-dashed sticky top-0 bg-background z-10">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-4">
          <button
            onClick={() => router.push(`/shorts?url=${encodeURIComponent(data.sourceUrl)}`)}
            className="p-2 hover:bg-muted transition-colors border border-dashed"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="min-w-0">
            <h1 className="font-medium">Select Short</h1>
            {data.videoInfo && (
              <p className="text-xs text-muted-foreground truncate">{data.videoInfo.title}</p>
            )}
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex flex-col lg:flex-row gap-8">
          <ShortPreview
            ref={iphoneRef}
            streamUrl={data.streamUrl}
            selectedShort={selectedShort}
            selectedIndex={selectedIndex}
            isPlaying={isPlaying}
            onTogglePlay={handleTogglePlay}
            onEditClick={handleEditClick}
          />
          <ShortsList
            shorts={data.shorts}
            selectedIndex={selectedIndex}
            videoInfo={data.videoInfo}
            onShortClick={handleShortClick}
          />
        </div>
      </div>
    </main>
  );
}
