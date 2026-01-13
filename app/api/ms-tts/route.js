import { NextResponse } from "next/server";
import { UniversalEdgeTTS } from "edge-tts-universal";
import Mixpanel from "mixpanel";

export const maxDuration = 120;

// Initialize Mixpanel for server-side tracking
const mixpanel = process.env.MIXPANEL_TOKEN 
  ? Mixpanel.init(process.env.MIXPANEL_TOKEN) 
  : null;

// Helper function to format timestamp for SRT (HH:MM:SS,mmm)
function formatSrtTimestamp(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const milliseconds = ms % 1000;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')},${String(milliseconds).padStart(3, '0')}`;
}

// Create SRT with grouped words (4-5 words per subtitle)
// NOTE: The library returns offset and duration in 100-nanosecond units (ticks)
// We need to convert to milliseconds by dividing by 10,000
function createGroupedSRT(wordBoundaries, wordsPerGroup = 5) {
  if (!wordBoundaries || wordBoundaries.length === 0) return "";
  
  let srtContent = "";
  let subtitleIndex = 1;
  
  for (let i = 0; i < wordBoundaries.length; i += wordsPerGroup) {
    const groupEnd = Math.min(i + wordsPerGroup, wordBoundaries.length);
    const group = wordBoundaries.slice(i, groupEnd);
    
    if (group.length === 0) continue;
    
    // Convert from 100-nanosecond units to milliseconds (divide by 10,000)
    const startTimeMs = Math.floor(group[0].offset / 10000);
    const lastWord = group[group.length - 1];
    const endTimeMs = Math.floor((lastWord.offset + lastWord.duration) / 10000);
    const text = group.map(w => w.text).join(' ');
    
    srtContent += `${subtitleIndex}\n`;
    srtContent += `${formatSrtTimestamp(startTimeMs)} --> ${formatSrtTimestamp(endTimeMs)}\n`;
    srtContent += `${text}\n\n`;
    subtitleIndex++;
  }
  
  return srtContent;
}

const VOICES = {
  // ===== US MALE VOICES (NARRATOR/STORYTELLING) =====
  "en-US-GuyNeural": { name: "Guy", gender: "Male", style: "�️ Deep Narrator", lang: "en-US", featured: true, category: "narrator" },
  "en-CA-LiamNeural": { name: "Liam", gender: "Male", style: "� Canadian", lang: "en-CA", featured: true, category: "narrator" },
  "en-US-ChristopherNeural": { name: "Christopher", gender: "Male", style: "🎙️ Professional", lang: "en-US", featured: true, category: "narrator" },
  "en-US-EricNeural": { name: "Eric", gender: "Male", style: "🎙️ Friendly Deep", lang: "en-US", featured: true, category: "narrator" },
  "en-US-RogerNeural": { name: "Roger", gender: "Male", style: "🎙️ Senior Narrator", lang: "en-US", featured: true, category: "narrator" },
  "en-US-SteffanNeural": { name: "Steffan", gender: "Male", style: "🎙️ Authoritative", lang: "en-US", featured: true, category: "narrator" },
  "en-US-AndrewNeural": { name: "Andrew", gender: "Male", style: "🎙️ News Anchor", lang: "en-US", featured: true, category: "narrator" },
  "en-US-BrianNeural": { name: "Brian", gender: "Male", style: "🎙️ Newscast", lang: "en-US", featured: true, category: "narrator" },
  "en-US-AndrewMultilingualNeural": { name: "Andrew ML", gender: "Male", style: "🎙️ Warm Engaging", lang: "en-US", featured: true, category: "narrator" },
  "en-US-BrianMultilingualNeural": { name: "Brian ML", gender: "Male", style: "🎙️ Versatile", lang: "en-US", featured: true, category: "narrator" },
  
  // ===== US FEMALE VOICES =====
  "en-US-AvaNeural": { name: "Ava", gender: "Female", style: "🎙️ Expressive", lang: "en-US", featured: true, category: "narrator" },
  "en-US-AvaMultilingualNeural": { name: "Ava ML", gender: "Female", style: "🎙️ Expressive ML", lang: "en-US", featured: true, category: "narrator" },
  "en-US-AriaNeural": { name: "Aria", gender: "Female", style: "🎙️ Natural Narrator", lang: "en-US", featured: true, category: "narrator" },
  "en-US-JennyNeural": { name: "Jenny", gender: "Female", style: "🎙️ Warm Storyteller", lang: "en-US", featured: true, category: "narrator" },
  "en-US-MichelleNeural": { name: "Michelle", gender: "Female", style: "🎙️ Warm", lang: "en-US", featured: true, category: "narrator" },
  "en-US-EmmaNeural": { name: "Emma", gender: "Female", style: "📰 News Anchor", lang: "en-US", category: "news" },
  "en-US-EmmaMultilingualNeural": { name: "Emma ML", gender: "Female", style: "📰 News ML", lang: "en-US", category: "news" },
  "en-US-AnaNeural": { name: "Ana", gender: "Female", style: "💬 Young Friendly", lang: "en-US", category: "casual" },
  
  // ===== UK VOICES =====
  "en-GB-RyanNeural": { name: "Ryan", gender: "Male", style: "🇬🇧 British Male", lang: "en-GB", featured: true, category: "narrator" },
  "en-GB-ThomasNeural": { name: "Thomas", gender: "Male", style: "🇬🇧 British News", lang: "en-GB", category: "news" },
  "en-GB-SoniaNeural": { name: "Sonia", gender: "Female", style: "🇬🇧 British", lang: "en-GB", featured: true, category: "narrator" },
  "en-GB-LibbyNeural": { name: "Libby", gender: "Female", style: "🇬🇧 British Casual", lang: "en-GB", category: "casual" },
  "en-GB-MaisieNeural": { name: "Maisie", gender: "Female", style: "🇬🇧 British Young", lang: "en-GB", category: "casual" },
  
  // ===== AUSTRALIAN VOICES =====
  "en-AU-WilliamMultilingualNeural": { name: "William ML", gender: "Male", style: "🇦🇺 Australian", lang: "en-AU", featured: true, category: "narrator" },
  "en-AU-NatashaNeural": { name: "Natasha", gender: "Female", style: "🇦🇺 Australian", lang: "en-AU", category: "news" },
  
  // ===== INDIAN VOICES =====
  "en-IN-PrabhatNeural": { name: "Prabhat", gender: "Male", style: "🇮🇳 Indian Male", lang: "en-IN", category: "indian" },
  "en-IN-NeerjaNeural": { name: "Neerja", gender: "Female", style: "🇮🇳 Indian Female", lang: "en-IN", category: "indian" },
  "en-IN-NeerjaExpressiveNeural": { name: "Neerja Expressive", gender: "Female", style: "🇮🇳 Indian Expressive", lang: "en-IN", category: "indian" },
  
  // ===== CANADIAN VOICES =====
  "en-CA-ClaraNeural": { name: "Clara", gender: "Female", style: "🍁 Canadian", lang: "en-CA", category: "other" },
  
  // ===== IRISH VOICES =====
  "en-IE-ConnorNeural": { name: "Connor", gender: "Male", style: "☘️ Irish Male", lang: "en-IE", category: "other" },
  "en-IE-EmilyNeural": { name: "Emily", gender: "Female", style: "☘️ Irish Female", lang: "en-IE", category: "other" },
  
  // ===== NEW ZEALAND VOICES =====
  "en-NZ-MitchellNeural": { name: "Mitchell", gender: "Male", style: "🥝 NZ Male", lang: "en-NZ", category: "other" },
  "en-NZ-MollyNeural": { name: "Molly", gender: "Female", style: "🥝 NZ Female", lang: "en-NZ", category: "other" },
  
  // ===== SINGAPORE VOICES =====
  "en-SG-WayneNeural": { name: "Wayne", gender: "Male", style: "🇸🇬 Singapore Male", lang: "en-SG", category: "other" },
  "en-SG-LunaNeural": { name: "Luna", gender: "Female", style: "🇸🇬 Singapore Female", lang: "en-SG", category: "other" },
  
  // ===== SOUTH AFRICAN VOICES =====
  "en-ZA-LukeNeural": { name: "Luke", gender: "Male", style: "🇿🇦 S.African Male", lang: "en-ZA", category: "other" },
  "en-ZA-LeahNeural": { name: "Leah", gender: "Female", style: "🇿🇦 S.African Female", lang: "en-ZA", category: "other" },
  
  // ===== AFRICAN VOICES =====
  "en-NG-AbeoNeural": { name: "Abeo", gender: "Male", style: "🇳🇬 Nigerian Male", lang: "en-NG", category: "other" },
  "en-NG-EzinneNeural": { name: "Ezinne", gender: "Female", style: "🇳🇬 Nigerian Female", lang: "en-NG", category: "other" },
  "en-KE-AsiliaNeural": { name: "Asilia", gender: "Female", style: "🇰🇪 Kenyan Female", lang: "en-KE", category: "other" },
  "en-KE-ChilembaNeural": { name: "Chilemba", gender: "Male", style: "🇰🇪 Kenyan Male", lang: "en-KE", category: "other" },
  "en-TZ-ElimuNeural": { name: "Elimu", gender: "Male", style: "🇹🇿 Tanzanian Male", lang: "en-TZ", category: "other" },
  "en-TZ-ImaniNeural": { name: "Imani", gender: "Female", style: "🇹🇿 Tanzanian Female", lang: "en-TZ", category: "other" },
  
  // ===== HONG KONG VOICES =====
  "en-HK-SamNeural": { name: "Sam", gender: "Male", style: "🇭🇰 Hong Kong Male", lang: "en-HK", category: "other" },
  "en-HK-YanNeural": { name: "Yan", gender: "Female", style: "🇭🇰 Hong Kong Female", lang: "en-HK", category: "other" },
  
  // ===== PHILIPPINES VOICES =====
  "en-PH-JamesNeural": { name: "James", gender: "Male", style: "🇵🇭 Philippines Male", lang: "en-PH", category: "other" },
  "en-PH-RosaNeural": { name: "Rosa", gender: "Female", style: "🇵🇭 Philippines Female", lang: "en-PH", category: "other" },
};

export async function GET() {
  const voiceList = Object.entries(VOICES).map(([id, info]) => ({ id, ...info }));
  return NextResponse.json({ voices: voiceList });
}

export async function POST(request) {
  try {
    const { text, voice = "en-US-GuyNeural", rate = "+0%", pitch = "+0Hz", includeSrt = false } = await request.json();

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return NextResponse.json({ error: "Text is required" }, { status: 400 });
    }

    const trimmedText = text.trim();
    
    // Rate uses %, pitch uses Hz
    const formattedRate = rate.includes('%') ? rate : `${rate}%`;
    const formattedPitch = pitch.includes('Hz') ? pitch : pitch.replace('%', 'Hz');

    // Get request headers to detect source
    const userAgent = request.headers.get('user-agent') || 'Unknown';
    const referer = request.headers.get('referer') || '';
    const isFromUI = referer.includes('neural-tts') || referer.includes('localhost:3000') || referer.includes('vercel.app');
    
    // Track API usage in Mixpanel
    if (mixpanel) {
      mixpanel.track('API TTS Request', {
        source: isFromUI ? 'UI' : 'Direct API',
        voice,
        rate: formattedRate,
        pitch: formattedPitch,
        char_count: trimmedText.length,
        word_count: trimmedText.split(/\s+/).filter(w => w.length > 0).length,
        include_srt: includeSrt,
        user_agent: userAgent.substring(0, 200), // Limit length
        referer: referer.substring(0, 200),
      });
    }

    console.log(`TTS: ${voice}, ${formattedRate}, ${formattedPitch}, ${trimmedText.length} chars, srt: ${includeSrt}, source: ${isFromUI ? 'UI' : 'API'}`);

    // Create TTS instance
    const tts = new UniversalEdgeTTS(trimmedText, voice, {
      rate: formattedRate,
      pitch: formattedPitch,
    });
    
    // Synthesize
    const result = await tts.synthesize();
    
    // Get audio buffer
    const audioBuffer = Buffer.from(await result.audio.arrayBuffer());

    // If SRT requested, return JSON with audio + subtitles
    if (includeSrt) {
      // Create grouped SRT (4-5 words per subtitle)
      const wordBoundaries = result.subtitle || [];
      const srtContent = createGroupedSRT(wordBoundaries, 5);
      
      return NextResponse.json({
        audio: audioBuffer.toString('base64'),
        srt: srtContent,
        wordCount: wordBoundaries.length,
      });
    }

    // Default: return audio blob
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
