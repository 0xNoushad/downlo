"use client";

import { useState } from "react";
import { X, Download } from "lucide-react";

interface ThumbnailModalProps {
  isOpen: boolean;
  onClose: () => void;
  thumbnail: string;
  title: string;
  videoUrl: string;
}

export function ThumbnailModal({
  isOpen,
  onClose,
  thumbnail,
  title,
  videoUrl,
}: ThumbnailModalProps) {
  const [downloading, setDownloading] = useState(false);
  const [thumbnails, setThumbnails] = useState<any[]>([]);
  const [loadingThumbnails, setLoadingThumbnails] = useState(false);

  const fetchThumbnails = async () => {
    if (thumbnails.length > 0) return; // Already loaded

    setLoadingThumbnails(true);
    try {
      const response = await fetch("/api/thumbnail", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: videoUrl, quality: "best" }),
      });

      if (response.ok) {
        const data = await response.json();
        setThumbnails(data.thumbnails || []);
      }
    } catch (error) {
      console.error("Failed to fetch thumbnails:", error);
    } finally {
      setLoadingThumbnails(false);
    }
  };

  const downloadThumbnail = async (thumbnailUrl: string, quality: string) => {
    setDownloading(true);
    try {
      const filename = `${title.replace(/[^a-zA-Z0-9]/g, "_")}_${quality}.jpg`;
      const response = await fetch(
        `/api/thumbnail?url=${encodeURIComponent(
          thumbnailUrl
        )}&filename=${filename}`
      );

      if (response.ok) {
        const blob = await response.blob();
        const link = document.createElement("a");
        const objectUrl = URL.createObjectURL(blob);
        link.href = objectUrl;
        link.download = filename;

        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(objectUrl);
      }
    } catch (error) {
      console.error("Download failed:", error);
    } finally {
      setDownloading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-background border border-dashed max-w-4xl max-h-[90vh] w-full mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-dashed">
          <h3 className="font-medium">thumbnail preview</h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-muted border border-dashed"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4 overflow-y-auto max-h-[calc(90vh-120px)]">
          {/* Main thumbnail */}
          <div className="border border-dashed overflow-hidden">
            <div className="aspect-video w-full">
              <img
                src={thumbnail}
                alt={title}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="p-3 border-t border-dashed">
              <p className="text-sm font-medium mb-2">{title}</p>
              <button
                onClick={() => downloadThumbnail(thumbnail, "default")}
                disabled={downloading}
                className="flex items-center gap-2 px-3 py-2 border border-dashed hover:bg-muted disabled:opacity-50"
              >
                <Download className="w-4 h-4" />
                {downloading ? "downloading..." : "download thumbnail"}
              </button>
            </div>
          </div>

          {/* Additional thumbnails */}
          <div className="border border-dashed overflow-hidden">
            <div className="p-3 border-b border-dashed bg-card">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">
                  all available thumbnails
                </span>
                {!loadingThumbnails && thumbnails.length === 0 && (
                  <button
                    onClick={fetchThumbnails}
                    className="px-3 py-1 text-xs border border-dashed hover:bg-muted"
                  >
                    load thumbnails
                  </button>
                )}
              </div>
            </div>

            <div className="p-4">
              {loadingThumbnails && (
                <div className="flex flex-col items-center justify-center py-12">
                  <div className="relative w-6 h-6 mb-3">
                    <div className="absolute inset-0">
                      <div className="w-full h-full rounded-full border-2 border-muted-foreground/20"></div>
                      <div className="absolute inset-0 w-full h-full rounded-full border-2 border-transparent border-t-foreground animate-spin"></div>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    loading thumbnails...
                  </p>
                </div>
              )}

              {thumbnails.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {thumbnails.map((thumb, index) => (
                    <div
                      key={index}
                      className="border border-dashed overflow-hidden"
                    >
                      <div className="aspect-video">
                        <img
                          src={thumb.url}
                          alt={`Thumbnail ${index + 1}`}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="p-2">
                        <div className="text-xs text-muted-foreground mb-2">
                          {thumb.width}x{thumb.height} • {thumb.quality}
                        </div>
                        <button
                          onClick={() =>
                            downloadThumbnail(thumb.url, thumb.quality)
                          }
                          disabled={downloading}
                          className="w-full px-2 py-1 text-xs border border-dashed hover:bg-muted disabled:opacity-50"
                        >
                          <Download className="w-3 h-3 inline mr-1" />
                          download
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {!loadingThumbnails && thumbnails.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <p className="text-sm">
                    click "load thumbnails" to see all available sizes
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
