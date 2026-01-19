import { pipeline, env } from 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.2.4/dist/transformers.min.js';

// Skip local model checks to allow downloading from Hugging Face Hub
env.allowLocalModels = false;
env.useBrowserCache = true;

class PipelineSingleton {
    static task = 'automatic-speech-recognition';
    static model = 'Xenova/whisper-tiny.en'; // MUST use Xenova (ONNX) version for browser
    static instance = null;

    static async getInstance(progress_callback = null) {
        if (this.instance === null) {
            self.postMessage({ type: 'log', data: "Initializing pipeline..." });
            this.instance = await pipeline(this.task, this.model, {
                progress_callback,
                // Remove dtype constraint to allow default (q8/quantized) for speed/compat
            });
            self.postMessage({ type: 'log', data: "Pipeline ready." });
        }
        return this.instance;
    }
}

// Listen for messages from the main thread
self.addEventListener('message', async (event) => {
    const { audio, type } = event.data;

    if (type === 'transcribe') {
        try {
            console.log("[Worker] Starting transcription...");
            const transcriber = await PipelineSingleton.getInstance((data) => {
                // Pass full data object so UI can see filename
                self.postMessage({ type: 'download', data });
            });

            console.log("[Worker] Model loaded. Running inference on", audio.length, "samples");
            
            // Run transcription
            const output = await transcriber(audio, {
                chunk_length_s: 30,
                stride_length_s: 5,
                return_timestamps: true,
            });

            console.log("[Worker] Transcription complete:", output);
            self.postMessage({ type: 'complete', result: output });
        } catch (error) {
            console.error("[Worker] Error:", error);
            self.postMessage({ type: 'error', error: error.message });
        }
    }
});
