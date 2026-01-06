import { NextResponse } from "next/server";
import { EdgeTTS } from "node-edge-tts";
import { unlink, readFile } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";

/*
 * MICROSOFT EDGE NEURAL TTS - FREE, HIGH QUALITY HUMAN-LIKE VOICES
 * Using verified voice IDs from Microsoft Azure
 */

const VOICES = {
  // ===== NARRATOR / STORYTELLING VOICES =====
  "en-US-GuyNeural": { name: "Guy", gender: "Male", style: "🎙️ Audiobook Narrator", lang: "en-US", featured: true, category: "narrator" },
  "en-US-AriaNeural": { name: "Aria", gender: "Female", style: "🎙️ Natural Narrator", lang: "en-US", featured: true, category: "narrator" },
  "en-US-JennyNeural": { name: "Jenny", gender: "Female", style: "🎙️ Warm Storyteller", lang: "en-US", featured: true, category: "narrator" },
  "en-GB-RyanNeural": { name: "Ryan", gender: "Male", style: "🎙️ British Narrator", lang: "en-GB", featured: true, category: "narrator" },
  "en-AU-WilliamNeural": { name: "William", gender: "Male", style: "🎙️ Australian", lang: "en-AU", featured: true, category: "narrator" },
  "en-US-ChristopherNeural": { name: "Christopher", gender: "Male", style: "🎙️ Warm Male", lang: "en-US", featured: true, category: "narrator" },
  "en-GB-SoniaNeural": { name: "Sonia", gender: "Female", style: "🎙️ British Female", lang: "en-GB", featured: true, category: "narrator" },
  "en-US-MichelleNeural": { name: "Michelle", gender: "Female", style: "🎙️ Professional", lang: "en-US", featured: true, category: "narrator" },
  
  // ===== NEWSCAST / PROFESSIONAL =====
  "en-US-AndrewNeural": { name: "Andrew", gender: "Male", style: "📰 Newscast", lang: "en-US", category: "news" },
  "en-US-EmmaNeural": { name: "Emma", gender: "Female", style: "📰 News Anchor", lang: "en-US", category: "news" },
  "en-GB-ThomasNeural": { name: "Thomas", gender: "Male", style: "📰 British News", lang: "en-GB", category: "news" },
  "en-AU-NatashaNeural": { name: "Natasha", gender: "Female", style: "📰 Australian News", lang: "en-AU", category: "news" },
  
  // ===== CONVERSATIONAL / CASUAL =====
  "en-US-AnaNeural": { name: "Ana", gender: "Female", style: "💬 Young Friendly", lang: "en-US", category: "casual" },
  "en-GB-LibbyNeural": { name: "Libby", gender: "Female", style: "💬 British Casual", lang: "en-GB", category: "casual" },
  "en-GB-MiaNeural": { name: "Mia", gender: "Female", style: "💬 British Young", lang: "en-GB", category: "casual" },
  "en-AU-CarlyNeural": { name: "Carly", gender: "Female", style: "💬 Australian", lang: "en-AU", category: "casual" },
  
  // ===== INDIAN ENGLISH =====
  "en-IN-PrabhatNeural": { name: "Prabhat", gender: "Male", style: "🇮🇳 Indian Male", lang: "en-IN", category: "indian" },
  "en-IN-NeerjaNeural": { name: "Neerja", gender: "Female", style: "🇮🇳 Indian Female", lang: "en-IN", category: "indian" },
  
  // ===== HINDI =====
  "hi-IN-MadhurNeural": { name: "Madhur", gender: "Male", style: "🇮🇳 Hindi Male", lang: "hi-IN", category: "hindi" },
  "hi-IN-SwaraNeural": { name: "Swara", gender: "Female", style: "🇮🇳 Hindi Female", lang: "hi-IN", category: "hindi" },
  
  // ===== OTHER ENGLISH =====
  "en-CA-LiamNeural": { name: "Liam", gender: "Male", style: "🍁 Canadian", lang: "en-CA", category: "other" },
  "en-CA-ClaraNeural": { name: "Clara", gender: "Female", style: "🍁 Canadian", lang: "en-CA", category: "other" },
  "en-IE-ConnorNeural": { name: "Connor", gender: "Male", style: "☘️ Irish", lang: "en-IE", category: "other" },
  "en-NZ-MitchellNeural": { name: "Mitchell", gender: "Male", style: "🥝 New Zealand", lang: "en-NZ", category: "other" },
  "en-ZA-LukeNeural": { name: "Luke", gender: "Male", style: "🇿🇦 South African", lang: "en-ZA", category: "other" },
  "en-SG-WayneNeural": { name: "Wayne", gender: "Male", style: "🇸🇬 Singapore", lang: "en-SG", category: "other" },
  
  // ===== EUROPEAN =====
  "de-DE-ConradNeural": { name: "Conrad", gender: "Male", style: "🇩🇪 German", lang: "de-DE", category: "european" },
  "de-DE-KatjaNeural": { name: "Katja", gender: "Female", style: "🇩🇪 German", lang: "de-DE", category: "european" },
  "fr-FR-HenriNeural": { name: "Henri", gender: "Male", style: "🇫🇷 French", lang: "fr-FR", category: "european" },
  "fr-FR-DeniseNeural": { name: "Denise", gender: "Female", style: "🇫🇷 French", lang: "fr-FR", category: "european" },
  "es-ES-AlvaroNeural": { name: "Alvaro", gender: "Male", style: "🇪🇸 Spanish", lang: "es-ES", category: "european" },
  "es-ES-ElviraNeural": { name: "Elvira", gender: "Female", style: "🇪🇸 Spanish", lang: "es-ES", category: "european" },
  "it-IT-DiegoNeural": { name: "Diego", gender: "Male", style: "🇮🇹 Italian", lang: "it-IT", category: "european" },
  "it-IT-ElsaNeural": { name: "Elsa", gender: "Female", style: "🇮🇹 Italian", lang: "it-IT", category: "european" },
  "pt-BR-AntonioNeural": { name: "Antonio", gender: "Male", style: "🇧🇷 Brazilian", lang: "pt-BR", category: "european" },
  "pt-BR-FranciscaNeural": { name: "Francisca", gender: "Female", style: "🇧🇷 Brazilian", lang: "pt-BR", category: "european" },
  "nl-NL-MaartenNeural": { name: "Maarten", gender: "Male", style: "🇳🇱 Dutch", lang: "nl-NL", category: "european" },
  "ru-RU-DmitryNeural": { name: "Dmitry", gender: "Male", style: "🇷🇺 Russian", lang: "ru-RU", category: "european" },
  
  // ===== ASIAN =====
  "ja-JP-KeitaNeural": { name: "Keita", gender: "Male", style: "🇯🇵 Japanese", lang: "ja-JP", category: "asian" },
  "ja-JP-NanamiNeural": { name: "Nanami", gender: "Female", style: "🇯🇵 Japanese", lang: "ja-JP", category: "asian" },
  "ko-KR-InJoonNeural": { name: "InJoon", gender: "Male", style: "🇰🇷 Korean", lang: "ko-KR", category: "asian" },
  "ko-KR-SunHiNeural": { name: "SunHi", gender: "Female", style: "🇰🇷 Korean", lang: "ko-KR", category: "asian" },
  "zh-CN-YunxiNeural": { name: "Yunxi", gender: "Male", style: "🇨🇳 Chinese", lang: "zh-CN", category: "asian" },
  "zh-CN-XiaoxiaoNeural": { name: "Xiaoxiao", gender: "Female", style: "🇨🇳 Chinese", lang: "zh-CN", category: "asian" },
  
  // ===== MIDDLE EASTERN =====
  "ar-SA-HamedNeural": { name: "Hamed", gender: "Male", style: "🇸🇦 Arabic", lang: "ar-SA", category: "middle-east" },
  "ar-SA-ZariyahNeural": { name: "Zariyah", gender: "Female", style: "🇸🇦 Arabic", lang: "ar-SA", category: "middle-east" },
  "tr-TR-AhmetNeural": { name: "Ahmet", gender: "Male", style: "🇹🇷 Turkish", lang: "tr-TR", category: "middle-east" },
  "he-IL-AvriNeural": { name: "Avri", gender: "Male", style: "🇮🇱 Hebrew", lang: "he-IL", category: "middle-east" },
};

export async function GET() {
  const voiceList = Object.entries(VOICES).map(([id, info]) => ({ id, ...info }));
  return NextResponse.json({ voices: voiceList });
}

export async function POST(request) {
  const tempFile = join(tmpdir(), `tts-${Date.now()}-${Math.random().toString(36).slice(2)}.mp3`);
  
  try {
    const { text, voice = "en-US-GuyNeural", rate = "+0%", pitch = "+0%" } = await request.json();

    if (!text || text.trim().length === 0) {
      return NextResponse.json({ error: "Text is required" }, { status: 400 });
    }

    const voiceInfo = VOICES[voice];
    const lang = voiceInfo?.lang || "en-US";

    const tts = new EdgeTTS({
      voice: voice,
      lang: lang,
      outputFormat: "audio-24khz-48kbitrate-mono-mp3",
      rate: rate,
      pitch: pitch,
    });

    await tts.ttsPromise(text.trim(), tempFile);
    const audioBuffer = await readFile(tempFile);
    await unlink(tempFile).catch(() => {});

    return new NextResponse(audioBuffer, {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Length": audioBuffer.byteLength.toString(),
      },
    });
  } catch (error) {
    await unlink(tempFile).catch(() => {});
    console.error("TTS error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
