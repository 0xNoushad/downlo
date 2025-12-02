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

    // Get direct stream URL from yt-dlp
    const { stdout } = await execAsync(
      `yt-dlp -f "bestvideo[height<=720][ext=mp4]+bestaudio[ext=m4a]/best[height<=720][ext=mp4]/best" --get-url --no-warnings "${url}"`,
      { timeout: 30000 }
    );

    const directUrl = stdout.trim().split("\n")[0];
    if (!directUrl) {
      return Response.json({ error: "Could not get video URL" }, { status: 500 });
    }

    const duration = end - start;

    // Use FFmpeg to crop and save to cache
    const ffmpegCmd = [
      "ffmpeg",
      "-y",
      "-ss", start.toString(),
      "-i", `"${directUrl}"`,
      "-t", duration.toString(),
      "-vf", '"crop=ih*9/16:ih,scale=720:1280"',  // Crop to 9:16 and scale to 720p
      "-c:v", "libx264",
      "-preset", "fast",
      "-crf", "23",
      "-c:a", "aac",
      "-b:a", "128k",
      "-movflags", "+faststart",
      `"${cachedPath}"`,
    ].join(" ");

    console.log("Running FFmpeg crop...");
    await execAsync(ffmpegCmd, { timeout: 120000 });

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
