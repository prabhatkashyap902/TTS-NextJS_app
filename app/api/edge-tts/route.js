import { NextResponse } from "next/server";

/*
 * FREE TTS API - VoiceRSS Compatible
 * High quality, free tier available
 */

// Map StreamElements voice names to language codes for fallback TTS
const VOICE_TO_LANG = {
  // English voices -> en-us
  "Brian": "en-gb",
  "Matthew": "en-us",
  "Joey": "en-us",
  "Justin": "en-us",
  "Russell": "en-au",
  "Geraint": "en-gb",
  "Amy": "en-gb",
  "Emma": "en-gb",
  "Joanna": "en-us",
  "Kendra": "en-us",
  "Kimberly": "en-us",
  "Salli": "en-us",
  "Nicole": "en-au",
  "Raveena": "en-in",
  // German
  "Hans": "de-de",
  "Marlene": "de-de",
  // French
  "Mathieu": "fr-fr",
  "Celine": "fr-fr",
  // Italian
  "Giorgio": "it-it",
  "Carla": "it-it",
  // Spanish
  "Enrique": "es-es",
  "Conchita": "es-es",
  "Miguel": "es-mx",
  "Penelope": "es-mx",
  // Portuguese
  "Ricardo": "pt-br",
  "Vitoria": "pt-br",
  // Japanese
  "Takumi": "ja-jp",
  "Mizuki": "ja-jp",
  // Korean
  "Seoyeon": "ko-kr",
  // Chinese
  "Zhiyu": "zh-cn",
};

const VOICES = {
  "Brian": { name: "Brian", gender: "Male", style: "Deep British", lang: "en" },
  "Matthew": { name: "Matthew", gender: "Male", style: "Professional US", lang: "en" },
  "Joey": { name: "Joey", gender: "Male", style: "Friendly US", lang: "en" },
  "Justin": { name: "Justin", gender: "Male", style: "Young US", lang: "en" },
  "Russell": { name: "Russell", gender: "Male", style: "Australian", lang: "en" },
  "Geraint": { name: "Geraint", gender: "Male", style: "Welsh", lang: "en" },
  "Amy": { name: "Amy", gender: "Female", style: "British", lang: "en" },
  "Emma": { name: "Emma", gender: "Female", style: "British", lang: "en" },
  "Joanna": { name: "Joanna", gender: "Female", style: "US", lang: "en" },
  "Kendra": { name: "Kendra", gender: "Female", style: "US", lang: "en" },
  "Kimberly": { name: "Kimberly", gender: "Female", style: "US", lang: "en" },
  "Salli": { name: "Salli", gender: "Female", style: "US", lang: "en" },
  "Nicole": { name: "Nicole", gender: "Female", style: "Australian", lang: "en" },
  "Raveena": { name: "Raveena", gender: "Female", style: "Indian", lang: "en" },
  "Hans": { name: "Hans", gender: "Male", style: "German", lang: "de" },
  "Marlene": { name: "Marlene", gender: "Female", style: "German", lang: "de" },
  "Mathieu": { name: "Mathieu", gender: "Male", style: "French", lang: "fr" },
  "Celine": { name: "Celine", gender: "Female", style: "French", lang: "fr" },
  "Giorgio": { name: "Giorgio", gender: "Male", style: "Italian", lang: "it" },
  "Carla": { name: "Carla", gender: "Female", style: "Italian", lang: "it" },
  "Enrique": { name: "Enrique", gender: "Male", style: "Spanish", lang: "es" },
  "Conchita": { name: "Conchita", gender: "Female", style: "Spanish", lang: "es" },
  "Miguel": { name: "Miguel", gender: "Male", style: "Spanish US", lang: "es" },
  "Penelope": { name: "Penelope", gender: "Female", style: "Spanish US", lang: "es" },
  "Ricardo": { name: "Ricardo", gender: "Male", style: "Portuguese BR", lang: "pt" },
  "Vitoria": { name: "Vitoria", gender: "Female", style: "Portuguese BR", lang: "pt" },
  "Mizuki": { name: "Mizuki", gender: "Female", style: "Japanese", lang: "ja" },
  "Takumi": { name: "Takumi", gender: "Male", style: "Japanese", lang: "ja" },
  "Seoyeon": { name: "Seoyeon", gender: "Female", style: "Korean", lang: "ko" },
  "Zhiyu": { name: "Zhiyu", gender: "Female", style: "Chinese", lang: "zh" },
};

export async function GET() {
  const voiceList = Object.entries(VOICES).map(([id, info]) => ({
    id,
    ...info,
  }));
  return NextResponse.json({ voices: voiceList });
}

export async function POST(request) {
  try {
    const { text, voice = "Brian" } = await request.json();

    if (!text || text.trim().length === 0) {
      return NextResponse.json({ error: "Text is required" }, { status: 400 });
    }

    // Try multiple TTS services as fallbacks
    const cleanText = text.trim();
    
    // Service 1: Try tts.quest (free, good quality)
    try {
      const ttsQuestUrl = `https://api.streamelements.com/kappa/v2/speech?voice=${voice}&text=${encodeURIComponent(cleanText)}`;
      const response = await fetch(ttsQuestUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'audio/mpeg, audio/*, */*',
          'Accept-Language': 'en-US,en;q=0.9',
          'Referer': 'https://streamelements.com/',
          'Origin': 'https://streamelements.com',
        },
      });
      
      if (response.ok) {
        const audioBuffer = await response.arrayBuffer();
        return new NextResponse(audioBuffer, {
          status: 200,
          headers: {
            "Content-Type": "audio/mpeg",
            "Content-Length": audioBuffer.byteLength.toString(),
          },
        });
      }
    } catch (e) {
      console.log("StreamElements failed, trying fallback...");
    }

    // Service 2: Fallback to responsivevoice
    try {
      const lang = VOICE_TO_LANG[voice] || "en-us";
      const rvUrl = `https://texttospeech.responsivevoice.org/v1/text:synthesize?text=${encodeURIComponent(cleanText)}&lang=${lang.split('-')[0]}&engine=g1&name=&pitch=0.5&rate=0.5&volume=1&key=0POmS5Y2&gender=male`;
      
      const response = await fetch(rvUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        },
      });
      
      if (response.ok) {
        const audioBuffer = await response.arrayBuffer();
        return new NextResponse(audioBuffer, {
          status: 200,
          headers: {
            "Content-Type": "audio/mpeg",
            "Content-Length": audioBuffer.byteLength.toString(),
          },
        });
      }
    } catch (e) {
      console.log("ResponsiveVoice failed, trying final fallback...");
    }

    // Service 3: Final fallback - SoundOfText API
    const lang = VOICE_TO_LANG[voice]?.split('-')[0] || "en";
    const sotResponse = await fetch('https://api.soundoftext.com/sounds', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ engine: 'Google', data: { text: cleanText, voice: lang } }),
    });

    if (!sotResponse.ok) {
      throw new Error("All TTS services failed");
    }

    const sotData = await sotResponse.json();
    
    // Poll for completion
    let audioUrl = null;
    for (let i = 0; i < 30; i++) {
      await new Promise(r => setTimeout(r, 500));
      const statusRes = await fetch(`https://api.soundoftext.com/sounds/${sotData.id}`);
      const statusData = await statusRes.json();
      if (statusData.status === 'Done') {
        audioUrl = statusData.location;
        break;
      }
    }

    if (!audioUrl) {
      throw new Error("TTS generation timed out");
    }

    const audioResponse = await fetch(audioUrl);
    const audioBuffer = await audioResponse.arrayBuffer();

    return new NextResponse(audioBuffer, {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Length": audioBuffer.byteLength.toString(),
      },
    });

  } catch (error) {
    console.error("TTS error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
