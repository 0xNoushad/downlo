"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { ArrowLeft, Loader2 } from "lucide-react";
import { GenerateForm } from "./components/GenerateForm";

function TranscriptContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const videoUrl = searchParams.get("url") || "";

  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [step, setStep] = useState<"idle" | "transcribing" | "analyzing" | "generating">("idle");

  useEffect(() => {
    if (!videoUrl) {
      router.push("/");
    }
  }, [videoUrl, router]);

  const generateShorts = async () => {
    setGenerating(true);
    setError("");
    setStep("transcribing");

    try {
      await new Promise(r => setTimeout(r, 1500));
      setStep("analyzing");
      
      const response = await fetch("/api/shorts/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: videoUrl }),
      });

      await new Promise(r => setTimeout(r, 500));
      setStep("generating");

      if (response.ok) {
        const data = await response.json();
        
        sessionStorage.setItem("shorts_data", JSON.stringify({
          shorts: data.shorts || [],
          videoInfo: data.videoInfo,
          streamUrl: data.streamUrl || "",
          sourceUrl: videoUrl,
        }));
        
        router.push("/shorts/select");
      } else {
        const errorData = await response.json();
        setError(errorData.error || "Failed to generate shorts");
      }
    } catch {
      setError("Failed to generate shorts");
    } finally {
      setGenerating(false);
      setStep("idle");
    }
  };

  return (
    <main className="min-h-dvh bg-background">
      <header className="border-b border-dashed sticky top-0 bg-background z-10">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-4">
          <button
            onClick={() => router.push("/")}
            className="p-2 hover:bg-muted transition-colors border border-dashed"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <h1 className="font-medium">Auto Shorts Generator</h1>
        </div>
      </header>

      <GenerateForm
        generating={generating}
        step={step}
        error={error}
        onGenerate={generateShorts}
      />
    </main>
  );
}

export default function TranscriptPage() {
  return (
    <Suspense fallback={<div className="min-h-dvh flex items-center justify-center"><Loader2 className="w-10 h-10 animate-spin" /></div>}>
      <TranscriptContent />
    </Suspense>
  );
}
