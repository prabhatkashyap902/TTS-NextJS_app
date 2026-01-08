import { Geist, Geist_Mono, Pacifico } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const pacifico = Pacifico({
  variable: "--font-pacifico",
  weight: "400",
  subsets: ["latin"],
});

export const metadata = {
  title: "Free Text to Speech | Neural TTS - Unlimited Characters",
  description: "Convert text to speech for FREE using premium Neural voices. Unlimited characters, Fast processing, multiple voice styles. Perfect for audiobooks, podcasts, and narration. No API key required!",
  keywords: "text to speech, TTS, free TTS, neural voices, audiobook generator, speech synthesis, voice generator, narrator voice, podcast TTS, AI voice",
  authors: [{ name: "TTS Generator" }],
  openGraph: {
    title: "Free Text to Speech | Neural TTS",
    description: "Convert unlimited text to natural-sounding speech with premium Neural voices. 100% FREE, no API key required!",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "Free Text to Speech | Neural TTS",
    description: "Convert unlimited text to speech with premium neural voices. FREE, fast, and natural-sounding!",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${pacifico.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
