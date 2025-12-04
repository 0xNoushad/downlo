import { NextRequest } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";
import { mkdir, readFile, access } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { createHash } from "crypto";

const execAsync = promisify(exec);

// Cache directory for cropped videos
const CACHE_DIR = join(tmpdir(), "shorts-crop-cache");

// Generate cache key from URL and time range
function getCacheKey(url: string, start: number, end: number): string {
  const hash = createHash("md5")
    .update(`${url}-${start}-${end}`)
    .digest("hex");
  return hash;
}

// Check if file exists
async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  
  // Support direct cache key lookup (pre-cropped during generation)
  const cacheKey = searchParams.get("key");
  if (cacheKey) {
    const cachedPath = join(CACHE_DIR, `${cacheKey}.mp4`);
    if (await fileExists(cachedPath)) {
      const fileBuffer = await readFile(cachedPath);
      return new Response(new Uint8Array(fileBuffer), {
        headers: {
          "Content-Type": "video/mp4",
          "Cache-Control": "public, max-age=3600",
          "X-Cache": "HIT",
        },
      });
    }
    return Response.json({ error: "Cached video not found" }, { status: 404 });
  }
  
  // Fallback: crop on-demand if not pre-cached
  const rawUrl = searchParams.get("url");
  const start = parseFloat(searchParams.get("start") || "0");
  const end = parseFloat(searchParams.get("end") || "60");

  if (!rawUrl) {
    return Response.json({ error: "URL is required" }, { status: 400 });
  }

  // Decode URL
  let url = rawUrl;
  try {
    while (url.includes("%")) {
      const decoded = decodeURIComponent(url);
      if (decoded === url) break;
      url = decoded;
    }
  } catch {}

  try {
    // Ensure cache directory exists
    await mkdir(CACHE_DIR, { recursive: true });

    const generatedKey = getCacheKey(url, start, end);
    const cachedPath = join(CACHE_DIR, `${generatedKey}.mp4`);

    // Check if already cached
    if (await fileExists(cachedPath)) {
      console.log("Serving cached cropped video:", cacheKey);
      const fileBuffer = await readFile(cachedPath);
      return new Response(new Uint8Array(fileBuffer), {
        headers: {
          "Content-Type": "video/mp4",
          "Cache-Control": "public, max-age=3600",
          "X-Cache": "HIT",
        },
      });
    }

    console.log("Generating cropped video:", { url, start, end });

    const duration = end - start;

    // Get direct URL with audio using yt-dlp (format that includes both video+audio)
    console.log("Step 1: Getting direct URL from yt-dlp...");
    const { stdout: formatUrl } = await execAsync(
      `yt-dlp -f "best[height<=720]/best" -g --no-warnings "${url}"`,
      { timeout: 30000 }
    );
    
    const directUrl = formatUrl.trim();
    if (!directUrl) {
      throw new Error("Could not get video URL from yt-dlp");
    }
    console.log("Got direct URL:", directUrl.substring(0, 100) + "...");

    // Use FFmpeg to download segment and crop in one step
    const ffmpegCmd = [
      "ffmpeg",
      "-y",
      "-ss", start.toString(),
      `-i "${directUrl}"`,
      "-t", duration.toString(),
      "-vf", '"crop=ih*9/16:ih,scale=720:1280"',
      "-c:v", "libx264",
      "-preset", "fast",
      "-crf", "23",
      "-c:a", "aac",
      "-b:a", "128k",
      "-movflags", "+faststart",
      `"${cachedPath}"`,
    ].join(" ");

    console.log("Step 2: Processing with FFmpeg...");
    console.log("Command:", ffmpegCmd);
    const { stderr: ffErr } = await execAsync(ffmpegCmd, { timeout: 180000 });
    if (ffErr) console.log("FFmpeg stderr:", ffErr);

    // Verify output exists
    if (!(await fileExists(cachedPath))) {
      throw new Error("FFmpeg processing failed - output file not created");
    }

    // Read and return the file
    const fileBuffer = await readFile(cachedPath);
    
    return new Response(new Uint8Array(fileBuffer), {
      headers: {
        "Content-Type": "video/mp4",
        "Cache-Control": "public, max-age=3600",
        "X-Cache": "MISS",
      },
    });
  } catch (error: any) {
    console.error("Crop error:", error);
    return Response.json(
      { error: "Failed to crop video", details: error.message },
      { status: 500 }
    );
  }
}
