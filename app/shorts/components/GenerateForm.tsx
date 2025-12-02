"use client";

import { Loader2, Sparkles } from "lucide-react";
import { Iphone } from "../../components/ui/iphone";

interface GenerateFormProps {
  generating: boolean;
  step: "idle" | "transcribing" | "analyzing" | "generating";
  error: string;
  onGenerate: () => void;
}

export function GenerateForm({ generating, step, error, onGenerate }: GenerateFormProps) {
  const demoVideo = "https://videos.pexels.com/video-files/8946986/8946986-uhd_1440_2732_25fps.mp4";

  return (
    <div className="max-w-5xl mx-auto px-4 py-12">
      <div className="flex flex-col lg:flex-row items-center gap-12">
        <div className="w-[320px] shrink-0">
          <Iphone videoSrc={demoVideo} />
        </div>

        <div className="flex-1 space-y-6 text-center lg:text-left">
          <div className="space-y-3">
            <h2 className="text-3xl font-bold">Generate Auto Shorts</h2>
            <p className="text-muted-foreground text-lg">
              AI-powered clip extraction that finds the best moments from your video.
            </p>
          </div>

          <div className="space-y-3">
            <StepIndicator step={1} label="Transcribe video with AI" active={step === "transcribing"} />
            <StepIndicator step={2} label="Analyze for engaging moments" active={step === "analyzing"} />
            <StepIndicator step={3} label="Generate 30-60 sec clips" active={step === "generating"} />
          </div>

          <button
            onClick={onGenerate}
            disabled={generating}
            className="px-8 py-4 bg-foreground text-background font-medium text-lg flex items-center gap-3 hover:opacity-90 transition-opacity disabled:opacity-50 mx-auto lg:mx-0"
          >
            {generating ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                {step === "transcribing" && "Transcribing..."}
                {step === "analyzing" && "Analyzing content..."}
                {step === "generating" && "Creating clips..."}
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5" />
                Generate Shorts
              </>
            )}
          </button>

          {error && <p className="text-red-500">{error}</p>}
        </div>
      </div>
    </div>
  );
}

function StepIndicator({ step, label, active }: { step: number; label: string; active: boolean }) {
  return (
    <div className="flex items-center gap-3 justify-center lg:justify-start">
      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${active ? "bg-foreground text-background" : "bg-foreground/10"}`}>
        {step}
      </div>
      <span className={active ? "font-medium" : ""}>{label}</span>
    </div>
  );
}
