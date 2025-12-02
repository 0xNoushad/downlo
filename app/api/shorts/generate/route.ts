import { NextRequest } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";
import { readFile, mkdir } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { existsSync } from "fs";

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
    // Get direct video URL for preview (CSS will handle the crop visually)
    const { stdout } = await execAsync(
      `yt-dlp -f "best[ext=mp4]/best" --get-url --no-warnings --no-check-certificate "${url}"`,
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

function parseVTT(vttContent: string): TranscriptSegment[] {
  const segments: TranscriptSegment[] = [];
  const lines = vttContent.split("\n");
  
  let currentStart = 0;
  let currentEnd = 0;
  let currentText = "";

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Match timestamp line: 00:00:00.000 --> 00:00:05.000
    const timestampMatch = line.match(
      /(\d{2}):(\d{2}):(\d{2})\.(\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})\.(\d{3})/
    );
    
    if (timestampMatch) {
      // Save previous segment if exists
      if (currentText) {
        segments.push({
          start: currentStart,
          end: currentEnd,
          text: currentText.trim(),
        });
      }
      
      // Parse new timestamps
      currentStart =
        parseInt(timestampMatch[1]) * 3600 +
        parseInt(timestampMatch[2]) * 60 +
        parseInt(timestampMatch[3]) +
        parseInt(timestampMatch[4]) / 1000;
      currentEnd =
        parseInt(timestampMatch[5]) * 3600 +
        parseInt(timestampMatch[6]) * 60 +
        parseInt(timestampMatch[7]) +
        parseInt(timestampMatch[8]) / 1000;
      currentText = "";
    } else if (line && !line.startsWith("WEBVTT") && !line.match(/^\d+$/)) {
      // Text line (not header or cue number)
      currentText += " " + line.replace(/<[^>]*>/g, ""); // Remove HTML tags
    }
  }

  // Don't forget last segment
  if (currentText) {
    segments.push({
      start: currentStart,
      end: currentEnd,
      text: currentText.trim(),
    });
  }

  return mergeShortSegments(segments);
}

function mergeShortSegments(segments: TranscriptSegment[]): TranscriptSegment[] {
  if (segments.length === 0) return [];

  const merged: TranscriptSegment[] = [];
  let current = { ...segments[0] };

  for (let i = 1; i < segments.length; i++) {
    const seg = segments[i];
    
    // Merge if gap is small and combined duration < 10 seconds
    if (seg.start - current.end < 1 && seg.end - current.start < 10) {
      current.end = seg.end;
      current.text += " " + seg.text;
    } else {
      merged.push(current);
      current = { ...seg };
    }
  }
  merged.push(current);

  return merged;
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
  const scoredWindows: { start: number; end: number; text: string; score: number }[] = [];

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

  // Create Short objects
  selectedWindows.forEach((window, index) => {
    shorts.push({
      id: `short-${index}`,
      thumbnail: videoInfo.thumbnail,
      title: `${videoInfo.title} - Clip ${index + 1}`,
      startTime: Math.floor(window.start),
      endTime: Math.floor(window.end),
      transcript: window.text.substring(0, 300) + (window.text.length > 300 ? "..." : ""),
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
