import { ImageResponse } from 'next/og'

export const alt = 'Video Downloader - Download videos from YouTube, TikTok, Instagram and more'
export const size = {
  width: 1200,
  height: 600,
}
export const contentType = 'image/png'

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#f0f8ff',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#1a1a1a',
            borderRadius: 20,
            width: 100,
            height: 100,
            marginBottom: 30,
          }}
        >
          <div style={{ fontSize: 50, color: 'white' }}>⬇️</div>
        </div>
        <div
          style={{
            fontSize: 48,
            fontWeight: 'bold',
            color: '#1a1a1a',
            marginBottom: 15,
            textAlign: 'center',
          }}
        >
          Video Downloader
        </div>
        <div
          style={{
            fontSize: 24,
            color: '#4a5568',
            textAlign: 'center',
            maxWidth: 700,
            lineHeight: 1.3,
          }}
        >
          Download videos from YouTube, TikTok, Instagram and more
        </div>
        <div
          style={{
            display: 'flex',
            gap: 15,
            marginTop: 30,
            fontSize: 20,
          }}
        >
          <div style={{ 
            backgroundColor: '#1a1a1a', 
            color: 'white', 
            padding: '8px 16px', 
            borderRadius: 8,
          }}>
            🎬 YouTube
          </div>
          <div style={{ 
            backgroundColor: '#1a1a1a', 
            color: 'white', 
            padding: '8px 16px', 
            borderRadius: 8,
          }}>
            🎵 TikTok
          </div>
          <div style={{ 
            backgroundColor: '#1a1a1a', 
            color: 'white', 
            padding: '8px 16px', 
            borderRadius: 8,
          }}>
            📸 Instagram
          </div>
        </div>
      </div>
    ),
    {
      ...size,
    }
  )
}