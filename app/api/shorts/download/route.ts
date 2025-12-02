import { NextRequest } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";
import { mkdir, readFile, unlink } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { existsSync } from "fs";

const execAsync = promisify(exec);

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const rawUrl = searchParams.get("url");
  const start = parseFloat(searchParams.get("start") || "0");
  const end = parseFloat(searchParams.get("end") || "60");
  const quality = searchParams.get("quality") || "best";

  if (!rawUrl) {
    return Response.json({ error: "URL is required" }, { status: 400 });
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

    // Step 2: Use FFmpeg to crop to 9:16 with highest quality
    // crop=ih*9/16:ih crops width to 9:16 ratio based on height (center crop)
    // Using -crf 18 for high quality, -preset slow for better compression
    const ffmpegCmd = [
      "ffmpeg",
      "-y",
      `-i "${downloadPath}"`,
      '-vf "crop=ih*9/16:ih"',  // Center crop to 9:16 aspect ratio
      "-c:v libx264",
      "-crf 18",                 // High quality (lower = better, 18 is visually lossless)
      "-preset medium",          // Good balance of speed and quality
      "-c:a aac",
      "-b:a 192k",               // High quality audio
      "-movflags +faststart",
      `"${outputPath}"`,
    ].join(" ");

    console.log("Step 2: Cropping to 9:16 with FFmpeg...");
    await execAsync(ffmpegCmd, { timeout: 300000 });

    if (!existsSync(outputPath)) {
      throw new Error("FFmpeg crop failed - output file not created");
    }

    // Read and return the file
    const fileBuffer = await readFile(outputPath);

    // Cleanup
    try {
      await unlink(downloadPath);
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
