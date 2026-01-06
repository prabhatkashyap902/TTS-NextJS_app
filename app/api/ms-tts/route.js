import { NextResponse } from "next/server";
import { UniversalEdgeTTS } from "edge-tts-universal";

export const maxDuration = 120;

const VOICES = {
  "en-US-GuyNeural": { name: "Guy", gender: "Male", style: "🎙️ Audiobook Narrator", lang: "en-US", featured: true, category: "narrator" },
  "en-US-AriaNeural": { name: "Aria", gender: "Female", style: "🎙️ Natural Narrator", lang: "en-US", featured: true, category: "narrator" },
  "en-US-JennyNeural": { name: "Jenny", gender: "Female", style: "🎙️ Warm Storyteller", lang: "en-US", featured: true, category: "narrator" },
  "en-GB-RyanNeural": { name: "Ryan", gender: "Male", style: "🎙️ British Narrator", lang: "en-GB", featured: true, category: "narrator" },
  "en-AU-WilliamNeural": { name: "William", gender: "Male", style: "🎙️ Australian", lang: "en-AU", featured: true, category: "narrator" },
  "en-US-ChristopherNeural": { name: "Christopher", gender: "Male", style: "🎙️ Warm Male", lang: "en-US", featured: true, category: "narrator" },
  "en-GB-SoniaNeural": { name: "Sonia", gender: "Female", style: "🎙️ British Female", lang: "en-GB", featured: true, category: "narrator" },
  "en-US-MichelleNeural": { name: "Michelle", gender: "Female", style: "🎙️ Professional", lang: "en-US", featured: true, category: "narrator" },
  "en-US-AndrewNeural": { name: "Andrew", gender: "Male", style: "📰 Newscast", lang: "en-US", category: "news" },
  "en-US-EmmaNeural": { name: "Emma", gender: "Female", style: "📰 News Anchor", lang: "en-US", category: "news" },
  "en-GB-ThomasNeural": { name: "Thomas", gender: "Male", style: "📰 British News", lang: "en-GB", category: "news" },
  "en-AU-NatashaNeural": { name: "Natasha", gender: "Female", style: "📰 Australian News", lang: "en-AU", category: "news" },
  "en-US-AnaNeural": { name: "Ana", gender: "Female", style: "💬 Young Friendly", lang: "en-US", category: "casual" },
  "en-GB-LibbyNeural": { name: "Libby", gender: "Female", style: "💬 British Casual", lang: "en-GB", category: "casual" },
  "en-GB-MiaNeural": { name: "Mia", gender: "Female", style: "💬 British Young", lang: "en-GB", category: "casual" },
  "en-AU-CarlyNeural": { name: "Carly", gender: "Female", style: "💬 Australian", lang: "en-AU", category: "casual" },
  "en-IN-PrabhatNeural": { name: "Prabhat", gender: "Male", style: "🇮🇳 Indian Male", lang: "en-IN", category: "indian" },
  "en-IN-NeerjaNeural": { name: "Neerja", gender: "Female", style: "🇮🇳 Indian Female", lang: "en-IN", category: "indian" },
  "hi-IN-MadhurNeural": { name: "Madhur", gender: "Male", style: "🇮🇳 Hindi Male", lang: "hi-IN", category: "hindi" },
  "hi-IN-SwaraNeural": { name: "Swara", gender: "Female", style: "🇮🇳 Hindi Female", lang: "hi-IN", category: "hindi" },
};

export async function GET() {
  const voiceList = Object.entries(VOICES).map(([id, info]) => ({ id, ...info }));
  return NextResponse.json({ voices: voiceList });
}

export async function POST(request) {
  try {
    const { text, voice = "en-US-GuyNeural", rate = "+0%", pitch = "+0Hz" } = await request.json();

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return NextResponse.json({ error: "Text is required" }, { status: 400 });
    }

    const trimmedText = text.trim();
    
    // Rate uses %, pitch uses Hz
    const formattedRate = rate.includes('%') ? rate : `${rate}%`;
    const formattedPitch = pitch.includes('Hz') ? pitch : pitch.replace('%', 'Hz');

    console.log(`TTS: ${voice}, ${formattedRate}, ${formattedPitch}, ${trimmedText.length} chars`);

    // Create TTS instance
    const tts = new UniversalEdgeTTS(trimmedText, voice, {
      rate: formattedRate,
      pitch: formattedPitch,
    });
    
    // Synthesize
    const result = await tts.synthesize();
    
    // Get audio buffer correctly
    const audioBuffer = Buffer.from(await result.audio.arrayBuffer());

    return new NextResponse(audioBuffer, {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Length": audioBuffer.byteLength.toString(),
      },
    });
  } catch (error) {
    console.error("TTS error:", error);
    return NextResponse.json({ error: error.message || "TTS failed" }, { status: 500 });
  }
}
