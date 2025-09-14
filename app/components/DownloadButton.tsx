'use client'

import { useState } from 'react'

export function DownloadButton({ 
  url, 
  format, 
  startTime, 
  endTime 
}: { 
  url: string; 
  format: string; 
  startTime?: string;
  endTime?: string;
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const handleDownload = async () => {
    setLoading(true)
    setError(null)
    setSuccess(false)
    
    try {
      const response = await fetch('/api/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, format, startTime, endTime }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Download failed')
      }

      const blob = await response.blob()
      const link = document.createElement('a')
      const objectUrl = URL.createObjectURL(blob)
      link.href = objectUrl

      const isAudio = format?.includes('audio')
      const extension = isAudio ? 'mp3' : 'mp4'
      const clipSuffix = (startTime || endTime) ? '_clip' : ''
      link.download = `video${clipSuffix}.${extension}`
      
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(objectUrl)
      
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
      
    } catch (error: any) {
      setError(error.message || 'Download failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-3">
      <button
        onClick={handleDownload}
        disabled={loading || !url}
        className={`w-full py-3 px-6 border border-dashed font-medium transition-colors ${
          loading || !url
            ? 'bg-muted cursor-not-allowed text-muted-foreground'
            : success
            ? 'bg-green-500 text-white border-green-500'
            : 'bg-foreground text-background hover:bg-foreground/90'
        }`}
      >
        {loading 
          ? 'downloading...' 
          : success 
          ? '✓ downloaded!' 
          : (startTime || endTime) ? 'download clip' : 'download'
        }
      </button>
      
      {error && (
        <div className="p-3 border border-dashed border-red-500 bg-red-500/10">
          <p className="text-sm text-red-500">{error}</p>
        </div>
      )}
    </div>
  )
}
