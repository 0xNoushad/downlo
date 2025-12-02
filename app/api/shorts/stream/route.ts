import { NextRequest } from "next/server";
import { exec, spawn } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

// Stream video cropped to 9:16 aspect ratio
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const rawUrl = searchParams.get("url");
  const start = parseFloat(searchParams.get("start") || "0");
  const end = searchParams.get("end") ? parseFloat(searchParams.get("end")!) : undefined;

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
    // Get direct stream URL from yt-dlp (best quality mp4)
    const { stdout } = await execAsync(
      `yt-dlp -f "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best" --get-url --no-warnings "${url}"`,
      { timeout: 30000 }
    );

    const directUrl = stdout.trim().split("\n")[0];
    
    if (!directUrl) {
      return Response.json({ error: "Could not get video URL" }, { status: 500 });
    }

    // Build FFmpeg command for streaming cropped video
    const ffmpegArgs = [
      "-ss", start.toString(),
      "-i", directUrl,
    ];

    // Add duration if end time specified
    if (end !== undefined) {
      ffmpegArgs.push("-t", (end - start).toString());
    }

    // Add crop filter and output settings
    ffmpegArgs.push(
      "-vf", "crop=ih*9/16:ih",  // Center crop to 9:16
      "-c:v", "libx264",
      "-preset", "ultrafast",     // Fast encoding for streaming
      "-crf", "23",               // Good quality for preview
      "-c:a", "aac",
      "-b:a", "128k",
      "-movflags", "frag_keyframe+empty_moov+faststart",  // Enable streaming
      "-f", "mp4",
      "pipe:1"                    // Output to stdout
    );

    // Spawn FFmpeg process
    const ffmpeg = spawn("ffmpeg", ffmpegArgs);

    // Create readable stream from FFmpeg output
    const stream = new ReadableStream({
      start(controller) {
        ffmpeg.stdout.on("data", (chunk) => {
          controller.enqueue(chunk);
        });

        ffmpeg.stdout.on("end", () => {
          controller.close();
        });

        ffmpeg.stderr.on("data", (data) => {
          // Log FFmpeg progress/errors (don't send to client)
          console.log("FFmpeg:", data.toString());
        });

        ffmpeg.on("error", (err) => {
          console.error("FFmpeg error:", err);
          controller.error(err);
        });

        ffmpeg.on("close", (code) => {
          if (code !== 0) {
            console.log(`FFmpeg exited with code ${code}`);
          }
        });
      },
      cancel() {
        ffmpeg.kill("SIGTERM");
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "video/mp4",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (error: any) {
    console.error("Stream error:", error);
    return Response.json(
      { error: "Failed to stream video", details: error.message },
      { status: 500 }
    );
  }
}
