import { NextRequest } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";
import { mkdir, readFile, unlink, writeFile } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { existsSync } from "fs";

const execAsync = promisify(exec);

interface TranscriptSegment {
  start: number;
  end: number;
  text: string;
}

interface CaptionStyleConfig {
  fontFamily: string;
  fontSize: number;
  fontWeight: string;
  color: string;
  backgroundColor: string;
  position: "top" | "middle" | "bottom";
  maxWords?: number;
}

// Convert seconds to SRT time format (HH:MM:SS,mmm)
function toSrtTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.round((seconds % 1) * 1000);
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")},${String(ms).padStart(3, "0")}`;
}

// Decode HTML entities
function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&gt;/g, ">")
    .replace(/&lt;/g, "<")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, "/")
    .replace(/&nbsp;/g, " ");
}

// Chunk segments by word count
function chunkSegments(
  segments: TranscriptSegment[],
  maxWords: number,
  clipStart: number
): TranscriptSegment[] {
  const chunked: TranscriptSegment[] = [];
  
  for (const seg of segments) {
    // Decode HTML entities and clean text
    const cleanText = decodeHtmlEntities(seg.text).trim();
    
    // Skip empty or whitespace-only segments
    if (!cleanText || cleanText.length === 0) continue;
    
    const words = cleanText.split(/\s+/).filter(w => w.length > 0);
    
    // If within limit, add as-is
    if (words.length <= maxWords) {
      chunked.push({
        start: seg.start,
        end: seg.end,
        text: cleanText,
      });
      continue;
    }
    
    // Split into chunks
    const segDuration = seg.end - seg.start;
    const timePerWord = segDuration / words.length;
    
    for (let i = 0; i < words.length; i += maxWords) {
      const chunkWords = words.slice(i, i + maxWords);
      const chunkStart = seg.start + (i * timePerWord);
      const chunkEnd = Math.min(seg.end, seg.start + ((i + chunkWords.length) * timePerWord));
      
      chunked.push({
        start: chunkStart,
        end: chunkEnd,
        text: chunkWords.join(" "),
      });
    }
  }
  
  return chunked;
}

// Generate SRT content from segments
function generateSrt(
  segments: TranscriptSegment[],
  clipStart: number,
  maxWords: number = 5
): string {
  // Chunk and filter segments
  const chunked = chunkSegments(segments, maxWords, clipStart);
  
  return chunked
    .map((seg, i) => {
      // Adjust times relative to clip start
      const start = Math.max(0, seg.start - clipStart);
      const end = Math.max(0, seg.end - clipStart);
      // Skip if duration is too short or text is empty
      if (end - start < 0.1 || !seg.text.trim()) return null;
      return `${i + 1}\n${toSrtTime(start)} --> ${toSrtTime(end)}\n${seg.text}\n`;
    })
    .filter(Boolean)
    .join("\n");
}

// Convert hex color to ASS format (BGR)
function hexToAssBgr(hex: string): string {
  const r = hex.slice(1, 3);
  const g = hex.slice(3, 5);
  const b = hex.slice(5, 7);
  return `&H00${b}${g}${r}&`;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const rawUrl = searchParams.get("url");
  const start = parseFloat(searchParams.get("start") || "0");
  const end = parseFloat(searchParams.get("end") || "60");
  const quality = searchParams.get("quality") || "best";
  const segmentsParam = searchParams.get("segments");
  const styleParam = searchParams.get("captionStyle");

  if (!rawUrl) {
    return Response.json({ error: "URL is required" }, { status: 400 });
  }

  // Parse segments and style if provided
  let segments: TranscriptSegment[] = [];
  let captionStyle: CaptionStyleConfig | null = null;
  
  try {
    if (segmentsParam) {
      segments = JSON.parse(decodeURIComponent(segmentsParam));
    }
    if (styleParam) {
      captionStyle = JSON.parse(decodeURIComponent(styleParam));
    }
  } catch (e) {
    console.log("Failed to parse segments/style:", e);
  }

  // Decode URL - handle double encoding
  let url = rawUrl;
  try {
    while (url.includes("%")) {
      const decoded = decodeURIComponent(url);
      if (decoded === url) break;
      url = decoded;
    }
  } catch {}

  console.log("Decoded URL:", url);

  const tempDir = join(tmpdir(), `short-download-${Date.now()}`);
  const downloadPath = join(tempDir, "source.mp4");
  const srtPath = join(tempDir, "subtitles.srt");
  const outputPath = join(tempDir, "output.mp4");

  try {
    await mkdir(tempDir, { recursive: true });

    // Get highest quality format
    let formatStr: string;
    if (quality === "720") {
      formatStr = "bestvideo[height<=720][ext=mp4]+bestaudio[ext=m4a]/best[height<=720]";
    } else if (quality === "1080") {
      formatStr = "bestvideo[height<=1080][ext=mp4]+bestaudio[ext=m4a]/best[height<=1080]";
    } else {
      formatStr = "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best";
    }

    const duration = end - start;
    console.log(`Downloading: ${start}s to ${end}s (${duration}s) at ${quality}`);
    console.log(`Segments: ${segments.length}, Style: ${captionStyle ? "yes" : "no"}`);

    // Step 1: Download the segment using yt-dlp
    const ytdlpCmd = [
      "yt-dlp",
      `-f "${formatStr}"`,
      `--download-sections "*${start}-${end}"`,
      "--force-keyframes-at-cuts",
      "--merge-output-format mp4",
      "--no-warnings",
      `-o "${downloadPath}"`,
      `"${url}"`,
    ].join(" ");

    console.log("Step 1: Downloading segment with yt-dlp...");
    await execAsync(ytdlpCmd, { timeout: 300000 });

    if (!existsSync(downloadPath)) {
      throw new Error("Download failed - source file not created");
    }

    // Step 2: Generate SRT file if segments provided
    let subtitleFilter = "";
    if (segments.length > 0) {
      const maxWords = captionStyle?.maxWords || 5;
      const srtContent = generateSrt(segments, start, maxWords);
      await writeFile(srtPath, srtContent, "utf-8");
      console.log("Generated SRT file with", segments.length, "segments, maxWords:", maxWords);
      
      // Build subtitle filter with styling
      const fontSize = captionStyle?.fontSize || 24;
      const fontColor = captionStyle?.color || "#FFFFFF";
      const bgColor = captionStyle?.backgroundColor || "#000000";
      const position = captionStyle?.position || "bottom";
      
      // Calculate vertical position (MarginV)
      let marginV = 50; // bottom
      if (position === "top") marginV = 400;
      else if (position === "middle") marginV = 200;
      
      // Escape the path for FFmpeg filter
      const escapedSrtPath = srtPath.replace(/'/g, "'\\''").replace(/:/g, "\\:");
      
      // Use subtitles filter with force_style
      const fontWeight = captionStyle?.fontWeight === "bold" ? "1" : "0";
      subtitleFilter = `,subtitles='${escapedSrtPath}':force_style='FontSize=${fontSize},PrimaryColour=${hexToAssBgr(fontColor)},BackColour=${hexToAssBgr(bgColor)},BorderStyle=4,Outline=0,Shadow=0,MarginV=${marginV},Bold=${fontWeight},Alignment=2'`;
    }

    // Step 3: Use FFmpeg to crop to 9:16 and burn subtitles
    const ffmpegCmd = [
      "ffmpeg",
      "-y",
      `-i "${downloadPath}"`,
      `-vf "crop=ih*9/16:ih${subtitleFilter}"`,
      "-c:v libx264",
      "-crf 18",
      "-preset medium",
      "-c:a aac",
      "-b:a 192k",
      "-movflags +faststart",
      `"${outputPath}"`,
    ].join(" ");

    console.log("Step 2: Cropping to 9:16 with FFmpeg...");
    console.log("FFmpeg command:", ffmpegCmd);
    await execAsync(ffmpegCmd, { timeout: 300000 });

    if (!existsSync(outputPath)) {
      throw new Error("FFmpeg crop failed - output file not created");
    }

    // Read and return the file
    const fileBuffer = await readFile(outputPath);

    // Cleanup
    try {
      await unlink(downloadPath);
      if (existsSync(srtPath)) await unlink(srtPath);
      await unlink(outputPath);
      await execAsync(`rm -rf "${tempDir}"`);
    } catch {}

    return new Response(new Uint8Array(fileBuffer), {
      headers: {
        "Content-Type": "video/mp4",
        "Content-Disposition": `attachment; filename="short_${Math.floor(start)}-${Math.floor(end)}.mp4"`,
        "Content-Length": fileBuffer.length.toString(),
      },
    });
  } catch (error: any) {
    console.error("Download error:", error);

    // Cleanup on error
    try {
      await execAsync(`rm -rf "${tempDir}"`);
    } catch {}

    return Response.json(
      {
        error: "Failed to download clip",
        details: error.message,
      },
      { status: 500 }
    );
  }
}
