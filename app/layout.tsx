import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "./components/theme-provider";
import { Navbar } from "./components/navbar";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL('https://video-downloader.railway.app'),
  title: "Video Downloader - Download from YouTube, TikTok, Instagram & More",
  description: "Free online video downloader. Download videos from YouTube, TikTok, Instagram, Twitter, Facebook, Vimeo and more platforms. Fast, secure, and easy to use.",
  keywords: [
    "video downloader",
    "youtube downloader", 
    "tiktok downloader",
    "instagram video download",
    "twitter video download",
    "facebook video download",
    "vimeo downloader",
    "online video downloader",
    "free video download",
    "video converter",
    "mp4 download",
    "mp3 download",
    "social media downloader",
    "clip downloader",
    "video extractor"
  ],
  authors: [{ name: "Video Downloader" }],
  creator: "Video Downloader",
  publisher: "Video Downloader",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
    ],
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://your-domain.com",
    title: "Video Downloader - Download from YouTube, TikTok, Instagram & More",
    description: "Free online video downloader. Download videos from YouTube, TikTok, Instagram, Twitter, Facebook, Vimeo and more platforms. Fast, secure, and easy to use.",
    siteName: "Video Downloader",
  },
  twitter: {
    card: "summary_large_image",
    title: "Video Downloader - Download from YouTube, TikTok, Instagram & More",
    description: "Free online video downloader. Download videos from YouTube, TikTok, Instagram, Twitter, Facebook, Vimeo and more platforms. Fast, secure, and easy to use.",
    creator: "@videodownloader",
  },
  alternates: {
    canonical: "https://your-domain.com",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          <Navbar />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
