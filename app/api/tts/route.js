import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";

// Get API keys from environment variables
function getApiKeysFromEnv() {
  const keys = [];
  for (let i = 1; i <= 20; i++) {
    const key = process.env[`API_KEY${i}`];
    if (key && key.trim()) {
      keys.push(key.trim());
    }
  }
  return keys;
}

// Split text into chunks of approximately maxWords each
function splitTextIntoChunks(text, maxWords = 5000) {
  const words = text.split(/\s+/).filter((word) => word.length > 0);
  const chunks = [];
  let currentChunk = [];

  for (const word of words) {
    currentChunk.push(word);
    if (currentChunk.length >= maxWords) {
      // Try to break at sentence boundaries
      const chunkText = currentChunk.join(" ");
      const lastSentenceEnd = Math.max(
        chunkText.lastIndexOf("."),
        chunkText.lastIndexOf("!"),
        chunkText.lastIndexOf("?")
      );

      if (lastSentenceEnd > chunkText.length * 0.7) {
        // Break at sentence if it's past 70% of chunk
        chunks.push(chunkText.substring(0, lastSentenceEnd + 1).trim());
        const remainingText = chunkText.substring(lastSentenceEnd + 1).trim();
        currentChunk = remainingText ? remainingText.split(/\s+/) : [];
      } else {
        chunks.push(chunkText);
        currentChunk = [];
      }
    }
  }

  // Add remaining words as final chunk
  if (currentChunk.length > 0) {
    chunks.push(currentChunk.join(" "));
  }

  return chunks;
}

// Generate TTS for a single chunk
async function generateTTSForChunk(apiKey, text, voice, styleInstructions) {
  const ai = new GoogleGenAI({ apiKey });

  // Combine style instructions with the text
  const prompt = styleInstructions ? `${styleInstructions}\n\n${text}` : text;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-preview-tts",
    contents: [{ parts: [{ text: prompt }] }],
    config: {
      responseModalities: ["AUDIO"],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: {
            voiceName: voice,
          },
        },
      },
    },
  });

  const audioData =
    response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

  if (!audioData) {
    throw new Error("No audio data received from the API");
  }

  return audioData;
}

// Generate voice preview (short sample)
async function generateVoicePreview(apiKey, voice) {
  const ai = new GoogleGenAI({ apiKey });

  // Simple, short text for consistent voice preview
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-preview-tts",
    contents: [
      {
        parts: [
          {
            text: `The quick brown fox jumps over the lazy dog. This is ${voice}.`,
          },
        ],
      },
    ],
    config: {
      responseModalities: ["AUDIO"],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: {
            voiceName: voice,
          },
        },
      },
    },
  });

  const audioData =
    response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

  if (!audioData) {
    throw new Error("No audio data received from the API");
  }

  return audioData;
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { action, text, voice, styleInstructions, chunkIndex } = body;

    // Get API keys from environment
    const apiKeys = getApiKeysFromEnv();

    if (apiKeys.length === 0) {
      return NextResponse.json(
        {
          error:
            "No API keys configured. Please add API_KEY1, API_KEY2, etc. to your .env.local file",
        },
        { status: 400 }
      );
    }

    // Handle voice preview request
    if (action === "preview") {
      if (!voice) {
        return NextResponse.json(
          { error: "Voice is required for preview" },
          { status: 400 }
        );
      }

      const audioData = await generateVoicePreview(apiKeys[0], voice);
      return NextResponse.json({
        success: true,
        audioData,
      });
    }

    // Handle single chunk generation (for sequential processing)
    if (action === "generateChunk") {
      if (!text || !voice || chunkIndex === undefined) {
        return NextResponse.json(
          { error: "Text, voice, and chunkIndex are required" },
          { status: 400 }
        );
      }

      // Select API key based on chunk index (round-robin)
      const apiKey = apiKeys[chunkIndex % apiKeys.length];
      const audioData = await generateTTSForChunk(
        apiKey,
        text,
        voice,
        styleInstructions
      );

      return NextResponse.json({
        success: true,
        audioData,
        apiKeyUsed: chunkIndex % apiKeys.length + 1,
      });
    }

    // Handle chunk preparation (return chunks info)
    if (action === "prepareChunks") {
      if (!text || text.trim().length === 0) {
        return NextResponse.json(
          { error: "Text is required" },
          { status: 400 }
        );
      }

      const chunks = splitTextIntoChunks(text.trim(), 5000);

      return NextResponse.json({
        success: true,
        totalChunks: chunks.length,
        chunks: chunks.map((chunk, index) => ({
          index,
          wordCount: chunk.split(/\s+/).length,
          text: chunk,
        })),
        totalApiKeys: apiKeys.length,
      });
    }

    // Handle get API key count
    if (action === "getKeyCount") {
      return NextResponse.json({
        success: true,
        keyCount: apiKeys.length,
      });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("TTS API Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to generate speech" },
      { status: 500 }
    );
  }
}
