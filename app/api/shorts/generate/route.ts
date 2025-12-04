import { NextRequest } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";
import { readFile, mkdir } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { existsSync } from "fs";
import { parseSync } from "subtitle";

const execAsync = promisify(exec);

interface TranscriptSegment {
  start: number;
  end: number;
  text: string;
}

interface Short {
  id: string;
  thumbnail: string;
  title: string;
  startTime: number;
  endTime: number;
  transcript: string;
  segments: TranscriptSegment[];
  score: number;
}

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json();

    if (!url) {
      return Response.json({ error: "URL is required" }, { status: 400 });
    }

    console.log("Starting shorts generation for:", url);

    // Step 1: Get video info
    const videoInfo = await getVideoInfo(url);
    if (!videoInfo) {
      return Response.json({ error: "Failed to get video info" }, { status: 500 });
    }

    console.log("Video info:", videoInfo);

    // Step 2: Get transcript (from subtitles or generate)
    const transcript = await getTranscript(url);
    console.log("Got transcript segments:", transcript.length);

    // Step 3: Analyze transcript and find best clip points
    const shorts = findBestClips(transcript, videoInfo);
    console.log("Generated shorts:", shorts.length);

    // Get stream URL for the video (used for preview with CSS cropping)
    const streamUrl = await getStreamUrl(url);

    return Response.json({
      shorts,
      videoInfo,
      streamUrl,
      sourceUrl: url,
      totalDuration: videoInfo.duration,
    });
  } catch (error: any) {
    console.error("Shorts generation error:", error);
    return Response.json(
      {
        error: "Failed to generate shorts",
        details: error.message,
      },
      { status: 500 }
    );
  }
}

async function getVideoInfo(url: string) {
  try {
    const { stdout } = await execAsync(
      `yt-dlp --dump-single-json --no-warnings --no-check-certificate "${url}"`
    );
    const info = JSON.parse(stdout);
    return {
      title: info.title || "Untitled",
      duration: info.duration || 0,
      thumbnail: info.thumbnail || "",
    };
  } catch (error) {
    console.error("Failed to get video info:", error);
    return null;
  }
}

async function getStreamUrl(url: string): Promise<string> {
  try {
    // Get 720p video URL for preview (better quality, CSS will handle the crop visually)
    const { stdout } = await execAsync(
      `yt-dlp -f "best[height<=720][ext=mp4]/best[height<=720]/best" --get-url --no-warnings --no-check-certificate "${url}"`,
      { timeout: 30000 }
    );
    return stdout.trim();
  } catch (error) {
    console.error("Failed to get stream URL:", error);
    return "";
  }
}

async function getTranscript(url: string): Promise<TranscriptSegment[]> {
  const tempDir = join(tmpdir(), `shorts-${Date.now()}`);
  
  try {
    await mkdir(tempDir, { recursive: true });

    // Try to get auto-generated subtitles
    const subtitlePath = join(tempDir, "subs");
    
    try {
      await execAsync(
        `yt-dlp --write-auto-sub --sub-lang en --skip-download --sub-format vtt -o "${subtitlePath}" --no-warnings "${url}"`,
        { timeout: 30000 }
      );

      // Check if subtitle file was created
      const vttPath = `${subtitlePath}.en.vtt`;
      if (existsSync(vttPath)) {
        const vttContent = await readFile(vttPath, "utf-8");
        const segments = parseVTT(vttContent);
        if (segments.length > 0) {
          console.log("Got subtitles from video");
          return segments;
        }
      }
    } catch (subError) {
      console.log("No subtitles available, using fallback");
    }

    // Fallback: Generate segments based on video duration
    const videoInfo = await getVideoInfo(url);
    if (videoInfo) {
      return generateSegmentsFromDuration(videoInfo.duration);
    }

    return generateSegmentsFromDuration(300); // Default 5 min
  } catch (error) {
    console.error("Transcript error:", error);
    return generateSegmentsFromDuration(300);
  } finally {
    // Cleanup
    try {
      await execAsync(`rm -rf "${tempDir}"`);
    } catch {}
  }
}

function cleanVTTText(text: string): string {
  return text
    // Remove VTT timing tags like <00:00:00.000>
    .replace(/<\d{2}:\d{2}:\d{2}\.\d{3}>/g, "")
    // Remove VTT style tags like <c>, </c>, <b>, etc.
    .replace(/<\/?[^>]+>/g, "")
    // Remove >>> and similar markers that YouTube adds
    .replace(/>{2,}/g, "")
    .replace(/<{2,}/g, "")
    // Decode HTML entities
    .replace(/&gt;/g, ">")
    .replace(/&lt;/g, "<")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&nbsp;/g, " ")
    // Remove [music] and similar markers
    .replace(/\[.*?\]/g, "")
    // Clean up whitespace and newlines
    .replace(/\n/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseVTT(vttContent: string): TranscriptSegment[] {
  // YouTube auto-generated VTT has overlapping progressive cues
  // Each cue contains previous text + new words
  // We need to extract only the NEW words from each cue
  
  try {
    const nodes = parseSync(vttContent);
    const rawCues: { start: number; end: number; text: string }[] = [];

    // First pass: collect all cues with cleaned text
    for (const node of nodes) {
      if (node.type === "cue" && node.data) {
        const cleanText = cleanVTTText(node.data.text);
        if (cleanText && cleanText.length > 1) {
          rawCues.push({
            start: node.data.start / 1000,
            end: node.data.end / 1000,
            text: cleanText,
          });
        }
      }
    }

    if (rawCues.length === 0) return [];

    // Second pass: extract only NEW text from each cue
    // YouTube VTT shows progressive text where each cue builds on previous
    const segments: TranscriptSegment[] = [];
    let lastText = "";

    for (let i = 0; i < rawCues.length; i++) {
      const cue = rawCues[i];
      let newText = cue.text;

      // Check if this cue's text starts with or contains the previous text
      if (lastText && cue.text.toLowerCase().startsWith(lastText.toLowerCase())) {
        // Extract only the new portion
        newText = cue.text.substring(lastText.length).trim();
      } else if (lastText) {
        // Check if previous text is contained within current (partial overlap)
        const lastWords = lastText.split(/\s+/);
        const currentWords = cue.text.split(/\s+/);
        
        // Find overlap at the end of lastText and start of currentText
        let overlapStart = 0;
        for (let j = Math.min(lastWords.length, currentWords.length); j > 0; j--) {
          const lastPart = lastWords.slice(-j).join(" ").toLowerCase();
          const currentPart = currentWords.slice(0, j).join(" ").toLowerCase();
          if (lastPart === currentPart) {
            overlapStart = j;
            break;
          }
        }
        
        if (overlapStart > 0) {
          newText = currentWords.slice(overlapStart).join(" ");
        }
      }

      // Only add if we have new meaningful text
      if (newText && newText.length > 1) {
        segments.push({
          start: cue.start,
          end: cue.end,
          text: newText,
        });
      }

      lastText = cue.text;
    }

    // Third pass: merge very short consecutive segments
    const mergedSegments: TranscriptSegment[] = [];
    let currentSegment: TranscriptSegment | null = null;

    for (const seg of segments) {
      if (!currentSegment) {
        currentSegment = { ...seg };
      } else if (seg.start - currentSegment.end < 0.5 && currentSegment.text.split(/\s+/).length < 8) {
        // Merge if gap is small and current segment is short
        currentSegment.end = seg.end;
        currentSegment.text = currentSegment.text + " " + seg.text;
      } else {
        mergedSegments.push(currentSegment);
        currentSegment = { ...seg };
      }
    }
    
    if (currentSegment) {
      mergedSegments.push(currentSegment);
    }

    return mergedSegments;
  } catch (error) {
    console.error("VTT parsing error:", error);
    return [];
  }
}



function generateSegmentsFromDuration(duration: number): TranscriptSegment[] {
  const segments: TranscriptSegment[] = [];
  const segmentLength = 15; // 15 second segments
  
  const placeholderTexts = [
    "This is an engaging moment from the video that captures attention.",
    "Key point being discussed here with important information.",
    "Interesting content that viewers would want to see.",
    "Valuable insight shared in this segment of the video.",
    "Compelling moment that makes for great short-form content.",
    "Highlight from the video with shareable content.",
  ];

  for (let i = 0; i < duration; i += segmentLength) {
    segments.push({
      start: i,
      end: Math.min(i + segmentLength, duration),
      text: placeholderTexts[Math.floor(i / segmentLength) % placeholderTexts.length],
    });
  }

  return segments;
}

function findBestClips(
  transcript: TranscriptSegment[],
  videoInfo: { title: string; duration: number; thumbnail: string }
): Short[] {
  const shorts: Short[] = [];
  const targetDuration = { min: 30, max: 60 };
  
  // Score each potential clip window
  const scoredWindows: { start: number; end: number; text: string; score: number; startIdx: number; endIdx: number }[] = [];

  // Slide through transcript to find good 30-60 second windows
  for (let i = 0; i < transcript.length; i++) {
    let windowText = "";
    let windowEnd = transcript[i].start;
    
    for (let j = i; j < transcript.length; j++) {
      windowText += " " + transcript[j].text;
      windowEnd = transcript[j].end;
      
      const windowDuration = windowEnd - transcript[i].start;
      
      if (windowDuration >= targetDuration.min && windowDuration <= targetDuration.max) {
        const score = scoreClip(windowText, windowDuration);
        scoredWindows.push({
          start: transcript[i].start,
          end: windowEnd,
          text: windowText.trim(),
          score,
          startIdx: i,
          endIdx: j,
        });
      }
      
      if (windowDuration > targetDuration.max) break;
    }
  }

  // Sort by score and pick top non-overlapping clips
  scoredWindows.sort((a, b) => b.score - a.score);
  
  const selectedWindows: typeof scoredWindows = [];
  for (const window of scoredWindows) {
    // Check for overlap with already selected
    const overlaps = selectedWindows.some(
      (selected) =>
        (window.start >= selected.start && window.start < selected.end) ||
        (window.end > selected.start && window.end <= selected.end) ||
        (window.start <= selected.start && window.end >= selected.end)
    );
    
    if (!overlaps) {
      selectedWindows.push(window);
      if (selectedWindows.length >= 5) break; // Max 5 shorts
    }
  }

  // Sort by time order
  selectedWindows.sort((a, b) => a.start - b.start);

  // Create Short objects with segments
  selectedWindows.forEach((window, index) => {
    // Get segments for this clip, adjusted to start from 0
    const clipSegments = transcript
      .slice(window.startIdx, window.endIdx + 1)
      .map(seg => ({
        start: seg.start - window.start,
        end: seg.end - window.start,
        text: seg.text,
      }));

    shorts.push({
      id: `short-${index}`,
      thumbnail: videoInfo.thumbnail,
      title: `${videoInfo.title} - Clip ${index + 1}`,
      startTime: Math.floor(window.start),
      endTime: Math.floor(window.end),
      transcript: window.text.substring(0, 300) + (window.text.length > 300 ? "..." : ""),
      segments: clipSegments,
      score: window.score,
    });
  });

  return shorts;
}

function scoreClip(text: string, duration: number): number {
  let score = 0;
  const lowerText = text.toLowerCase();

  // Engagement keywords
  const engagementWords = [
    "amazing", "incredible", "important", "secret", "tip", "trick",
    "how to", "why", "best", "top", "must", "need", "should",
    "learn", "discover", "reveal", "truth", "fact", "actually",
    "surprising", "shocking", "crazy", "insane", "game changer",
  ];

  for (const word of engagementWords) {
    if (lowerText.includes(word)) score += 10;
  }

  // Prefer clips with questions (engaging)
  if (text.includes("?")) score += 15;

  // Prefer clips with complete sentences
  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 10);
  score += sentences.length * 5;

  // Ideal duration bonus (45 seconds is sweet spot)
  const idealDuration = 45;
  const durationDiff = Math.abs(duration - idealDuration);
  score += Math.max(0, 20 - durationDiff);

  // Word count bonus (not too short, not too long)
  const wordCount = text.split(/\s+/).length;
  if (wordCount >= 50 && wordCount <= 150) score += 15;

  return score;
}
