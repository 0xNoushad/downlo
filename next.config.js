/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      allowedOrigins: ['localhost:3000']
    },
    // Configure external packages for server components to work in serverless environment
    serverComponentsExternalPackages: ['yt-dlp-exec', 'ffmpeg-static']
  },
  
  webpack: (config, { isServer }) => {
    // Client-side fallbacks for Node.js modules
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        punycode: false
      }
    }

    // Common externals for both client and server
    config.externals.push({
      'utf-8-validate': 'commonjs utf-8-validate',
      'bufferutil': 'commonjs bufferutil',
    })

    if (isServer) {
      config.externals.push('yt-dlp-exec', 'ffmpeg-static')
    }

    return config
  },
}

module.exports = nextConfig 


