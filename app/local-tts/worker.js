
import { KokoroTTS } from "kokoro-js";

class TextToSpeech {
  static instance = null;

  static async getInstance(progressCallback) {
    if (!this.instance) {
      // Initialize KokoroTTS using from_pretrained
      this.instance = await KokoroTTS.from_pretrained("onnx-community/Kokoro-82M-ONNX", {
        dtype: "q8", // Use quantized model for speed/size
        // device: "webgpu", // Removed to fix ORT provider issues
        progress_callback: (data) => {
            if (progressCallback) {
                progressCallback({
                    status: 'progress',
                    file: data.file,
                    progress: data.progress
                });
            }
        }
      });
    }
    return this.instance;
  }
}

// Helper to split text into chunks
function splitText(text, maxLength = 500) {
  const chunks = [];
  let remaining = text.trim();
  while (remaining.length > 0) {
    if (remaining.length <= maxLength) {
      chunks.push(remaining);
      break;
    }
    // Find closest sentence break
    let breakPoint = remaining.lastIndexOf('.', maxLength);
    if (breakPoint === -1) breakPoint = remaining.lastIndexOf('?', maxLength);
    if (breakPoint === -1) breakPoint = remaining.lastIndexOf('!', maxLength);
    // Fallback to space
    if (breakPoint === -1) breakPoint = remaining.lastIndexOf(' ', maxLength);
    // Fallback to hard cut
    if (breakPoint === -1) breakPoint = maxLength;
    
    chunks.push(remaining.substring(0, breakPoint + 1).trim());
    remaining = remaining.substring(breakPoint + 1).trim();
  }
  return chunks.filter(c => c.length > 0);
}

// Helper to concatenate float32 arrays
function concatAudio(buffers) {
  const totalLength = buffers.reduce((acc, b) => acc + b.length, 0);
  const result = new Float32Array(totalLength);
  let offset = 0;
  for (const buf of buffers) {
    result.set(buf, offset);
    offset += buf.length;
  }
  return result;
}

self.addEventListener('message', async (event) => {
  const { text, voice, speed, type } = event.data;

  try {
    const tts = await TextToSpeech.getInstance((data) => {
        self.postMessage({ ...data, type });
    });

    if (type === 'preview') {
       // Previews are short, play immediately
       self.postMessage({ status: 'generating', type });
       const audio = await tts.generate(text, { voice: voice || "af_bella", speed: speed || 1.0 });
       self.postMessage({
          status: 'complete',
          audio: audio.audio,
          sampling_rate: audio.sampling_rate,
          type
       });
       return;
    }

    // Main generation - Chunking
    self.postMessage({ status: 'generating', type }); // Initial status

    // Split text
    const chunks = splitText(text, 500); // 500 chars per chunk safely
    const audioBuffers = [];
    let sampleRate = 24000;

    for (let i = 0; i < chunks.length; i++) {
        // Report specific progress
        self.postMessage({ 
            status: 'progress_generation', 
            current: i + 1, 
            total: chunks.length,
            text: chunks[i].substring(0, 20) + "..."
        });

        const result = await tts.generate(chunks[i], {
            voice: voice || "af_bella",
            speed: speed || 1.0,
        });
        
        audioBuffers.push(result.audio);
        sampleRate = result.sampling_rate;
    }

    // Merge
    const finalAudio = concatAudio(audioBuffers);

    self.postMessage({
      status: 'complete',
      audio: finalAudio,
      sampling_rate: sampleRate,
      type
    });

  } catch (error) {
    console.error(error);
    self.postMessage({ status: 'error', error: error.message });
  }
});
