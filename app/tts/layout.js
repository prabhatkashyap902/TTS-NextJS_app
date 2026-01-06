export const metadata = {
  title: "Free Text to Speech | Microsoft Neural TTS - Unlimited Characters",
  description: "Convert text to speech for FREE using premium Microsoft Neural voices. Unlimited characters, parallel processing, multiple voice styles. Perfect for audiobooks, podcasts, and narration. No API key required!",
  keywords: "text to speech, TTS, free TTS, Microsoft TTS, neural voices, audiobook generator, speech synthesis, voice generator, narrator voice, podcast TTS, AI voice",
  authors: [{ name: "TTS Generator" }],
  openGraph: {
    title: "Free Text to Speech | Microsoft Neural TTS",
    description: "Convert unlimited text to natural-sounding speech with premium Microsoft Neural voices. 100% FREE, no API key required!",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "Free Text to Speech | Microsoft Neural TTS",
    description: "Convert unlimited text to speech with premium neural voices. FREE, fast, and natural-sounding!",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function TTSLayout({ children }) {
  return children;
}
