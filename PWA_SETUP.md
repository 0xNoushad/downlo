# PWA Setup Instructions

Your Next.js app has been configured as a Progressive Web App (PWA). Here's what you need to know:

1. Assets
   All required PWA assets have been generated and placed in the public/assets directory, including:
   - Favicons (16x16, 32x32)
   - Standard icons (48x48 to 512x512)
   - Apple Touch Icons (57x57 to 180x180)
   - Maskable icons (192x192, 512x512)
   - Social media images (og-image, twitter-card)
   - Device-specific splash screens (iPhone and iPad variants)

   To regenerate assets, you can run this CLI tool again with a different logo.

2. Configuration Files
   - manifest.json has been created in the public directory
   - next.config.js has been updated with PWA configuration

3. Testing
   - PWA is disabled in development by default
   - To test PWA features, build and start the production server:
     ```bash
     pnpm build
     pnpm start
     ```

4. Metadata Setup
   Add the following metadata to your src/app/layout.tsx file:

   For App Router (inside the metadata object):
   ```tsx
   import { Metadata } from 'next'
   
   export const metadata: Metadata = {
     manifest: '/manifest.json',
     themeColor: '#000000',
     viewport: {
       width: 'device-width',
       initialScale: 1
     },
     icons: {
       apple: '/assets/apple-touch-icon-180x180.png'
     },
     appleWebApp: {
       capable: true,
       statusBarStyle: 'default',
       title: 'clipit',
     },
     formatDetection: {
       telephone: false,
     },
     openGraph: {
       images: ['/assets/og-image.png'],
     },
     twitter: {
       card: 'summary_large_image',
       images: ['/assets/twitter-card.png'],
     },
   }
   ```

   Or if you prefer to use meta tags directly in your layout:
   ```tsx
   <head>
     <meta name="viewport" content="width=device-width, initial-scale=1" />
     <meta name="theme-color" content="#000000" />
     <link rel="manifest" href="/manifest.json" />
     <link rel="apple-touch-icon" href="/assets/apple-touch-icon-180x180.png" />
     <meta name="apple-mobile-web-app-capable" content="yes" />
     <meta name="apple-mobile-web-app-status-bar-style" content="default" />
     <meta name="apple-mobile-web-app-title" content="clipit" />
     <meta name="format-detection" content="telephone=no" />
     <meta property="og:image" content="/assets/og-image.png" />
     <meta name="twitter:card" content="summary_large_image" />
     <meta name="twitter:image" content="/assets/twitter-card.png" />
   </head>
   ```

