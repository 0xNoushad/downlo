'use client'

import { useState, useRef } from 'react'

interface UrlInputProps {
  url: string
  setUrl: (url: string) => void
  setVideoInfo: (info: any) => void
  loading: boolean
}

export function UrlInput({ url, setUrl, setVideoInfo, loading }: UrlInputProps) {
  const [isValid, setIsValid] = useState<boolean | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const platforms = [
    'youtube.com', 'youtu.be', 'vimeo.com', 'tiktok.com', 'instagram.com',
    'twitter.com', 'facebook.com', 'twitch.tv', 'soundcloud.com','pintrest.com'
  ]

  const handleChange = (value: string) => {
    setUrl(value)
    
    if (!value.trim()) {
      setIsValid(null)
      setVideoInfo(null)
      return
    }

    try {
      new URL(value)
      const supported = platforms.some(platform => value.includes(platform))
      setIsValid(supported)
      if (!supported) setVideoInfo(null)
    } catch {
      setIsValid(false)
      setVideoInfo(null)
    }
  }

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText()
      if (text?.startsWith('http')) {
        handleChange(text)
      }
    } catch {}
  }

  return (
    <div className="border border-dashed overflow-hidden">
      <div className="p-3 border-b border-dashed bg-card">
        <span className="text-sm font-medium">video url</span>
      </div>
      
      <div className="p-4">
        <div className="relative">
          <input
            ref={inputRef}
            type="url"
            value={url}
            onChange={(e) => handleChange(e.target.value)}
            placeholder="paste video url here..."
            className={`w-full px-3 py-2 pr-20 border border-dashed bg-transparent focus:ring-0 focus:outline-none ${
              isValid === false ? 'border-red-500' : 
              isValid === true ? 'border-green-500' : 'border-muted-foreground'
            }`}
            disabled={loading}
          />
          
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
            {loading && <div className="animate-spin w-4 h-4 border-2 border-foreground border-t-transparent rounded-full" />}
            {!loading && isValid === true && <span className="text-green-500">✓</span>}
            {!loading && isValid === false && <span className="text-red-500">✗</span>}
            
            <button
              type="button"
              onClick={handlePaste}
              className="px-2 py-1 text-xs border border-dashed hover:bg-muted"
            >
              paste
            </button>
          </div>
        </div>

        {isValid === false && (
          <p className="mt-2 text-sm text-red-500">
            please enter a valid url from a supported platform
          </p>
        )}
      </div>
    </div>
  )
}