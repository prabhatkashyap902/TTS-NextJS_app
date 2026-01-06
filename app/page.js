"use client";

import { useState, useRef, useEffect } from "react";

const VOICES = [
  { name: "Zephyr", description: "Bright" },
  { name: "Puck", description: "Upbeat" },
  { name: "Charon", description: "Informative" },
  { name: "Kore", description: "Firm" },
  { name: "Fenrir", description: "Excitable" },
  { name: "Leda", description: "Youthful" },
  { name: "Orus", description: "Firm" },
  { name: "Aoede", description: "Breezy" },
  { name: "Callirrhoe", description: "Easy-going" },
  { name: "Autonoe", description: "Bright" },
  { name: "Enceladus", description: "Breathy" },
  { name: "Iapetus", description: "Clear" },
  { name: "Umbriel", description: "Easy-going" },
  { name: "Algieba", description: "Smooth" },
  { name: "Despina", description: "Smooth" },
  { name: "Erinome", description: "Clear" },
  { name: "Algenib", description: "Gravelly" },
  { name: "Rasalgethi", description: "Informative" },
  { name: "Laomedeia", description: "Upbeat" },
  { name: "Achernar", description: "Soft" },
  { name: "Alnilam", description: "Firm" },
  { name: "Schedar", description: "Even" },
  { name: "Gacrux", description: "Mature" },
  { name: "Pulcherrima", description: "Forward" },
  { name: "Achird", description: "Friendly" },
  { name: "Zubenelgenubi", description: "Casual" },
  { name: "Vindemiatrix", description: "Gentle" },
  { name: "Sadachbia", description: "Lively" },
  { name: "Sadaltager", description: "Knowledgeable" },
  { name: "Sulafat", description: "Warm" },
];

export default function Home() {
  const [text, setText] = useState("");
  const [styleInstructions, setStyleInstructions] = useState(
    "Read aloud in a warm and friendly tone:"
  );
  const [selectedVoice, setSelectedVoice] = useState("Kore");
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(null);
  const [audioFiles, setAudioFiles] = useState([]);
  const [mergedAudio, setMergedAudio] = useState(null);
  const [errors, setErrors] = useState([]);
  const [previewingVoice, setPreviewingVoice] = useState(null);
  const [previewAudio, setPreviewAudio] = useState(null);
  const [apiKeyCount, setApiKeyCount] = useState(0);
  const audioRefs = useRef({});
  const previewAudioRef = useRef(null);

  const wordCount = text.trim()
    ? text.trim().split(/\s+/).filter((w) => w.length > 0).length
    : 0;

  const estimatedChunks = Math.ceil(wordCount / 5000) || 0;

  // Fetch API key count on mount
  useEffect(() => {
    fetch("/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "getKeyCount" }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.keyCount) {
          setApiKeyCount(data.keyCount);
        }
      })
      .catch(() => {});
  }, []);

  const handlePreviewVoice = async (voiceName) => {
    // If same voice is playing, stop it
    if (previewAudio && previewingVoice === voiceName) {
      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
        previewAudioRef.current.currentTime = 0;
      }
      setPreviewAudio(null);
      setPreviewingVoice(null);
      return;
    }

    // Stop any currently playing preview (different voice clicked)
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
      previewAudioRef.current.currentTime = 0;
    }
    setPreviewAudio(null);

    setPreviewingVoice(voiceName);

    try {
      const response = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "preview",
          voice: voiceName,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to generate preview");
      }

      const audioUrl = createAudioUrl(data.audioData);
      setPreviewAudio(audioUrl);

      // Auto-play the preview in background
      if (previewAudioRef.current) {
        previewAudioRef.current.src = audioUrl;
        previewAudioRef.current.play();
      }
    } catch (error) {
      alert(`Preview failed: ${error.message}`);
      setPreviewingVoice(null);
    }
  };


  const handleGenerate = async () => {
    if (!text.trim()) {
      alert("Please enter some text to convert");
      return;
    }

    setIsGenerating(true);
    setProgress({ status: "Preparing...", current: 0, total: 0 });
    setAudioFiles([]);
    setMergedAudio(null);
    setErrors([]);

    try {
      // First, prepare chunks
      const prepareResponse = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "prepareChunks",
          text: text.trim(),
        }),
      });

      const prepareData = await prepareResponse.json();

      if (!prepareResponse.ok) {
        throw new Error(prepareData.error || "Failed to prepare chunks");
      }

      const { chunks, totalApiKeys } = prepareData;
      const totalChunks = chunks.length;

      setProgress({
        status: "Generating...",
        current: 0,
        total: totalChunks,
        apiKeys: totalApiKeys,
      });

      // Process chunks sequentially with key rotation
      const generatedAudio = [];
      const chunkErrors = [];

      // Track which keys are busy
      const keyBusy = new Array(totalApiKeys).fill(false);
      const keyPromises = new Array(totalApiKeys).fill(null);

      // Process all chunks
      for (let i = 0; i < totalChunks; i++) {
        const chunk = chunks[i];
        const keyIndex = i % totalApiKeys;

        // Wait for this key to be free
        if (keyBusy[keyIndex] && keyPromises[keyIndex]) {
          await keyPromises[keyIndex];
        }

        // Mark key as busy
        keyBusy[keyIndex] = true;

        setProgress({
          status: `Generating audio ${i + 1} of ${totalChunks}...`,
          current: i + 1,
          total: totalChunks,
          apiKeys: totalApiKeys,
          currentKey: keyIndex + 1,
        });

        // Start generation for this chunk
        const generatePromise = (async () => {
          try {
            const response = await fetch("/api/tts", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                action: "generateChunk",
                text: chunk.text,
                voice: selectedVoice,
                styleInstructions: styleInstructions.trim(),
                chunkIndex: i,
              }),
            });

            const data = await response.json();

            if (!response.ok) {
              throw new Error(data.error || "Failed to generate chunk");
            }

            generatedAudio[i] = {
              index: i,
              label: `Audio ${i + 1}`,
              audioData: data.audioData,
              wordCount: chunk.wordCount,
              keyUsed: data.apiKeyUsed,
            };

            // Update audioFiles in real-time
            setAudioFiles([...generatedAudio.filter(Boolean)]);
          } catch (error) {
            chunkErrors.push({
              index: i,
              label: `Audio ${i + 1}`,
              error: error.message,
            });
          } finally {
            keyBusy[keyIndex] = false;
          }
        })();

        keyPromises[keyIndex] = generatePromise;

        // Wait for this chunk before moving to next
        await generatePromise;
      }

      // Wait for all remaining promises
      await Promise.all(keyPromises.filter(Boolean));

      // Set final results
      const finalAudio = generatedAudio.filter(Boolean);
      setAudioFiles(finalAudio);
      setErrors(chunkErrors);

      // Merge all audio if we have multiple chunks
      if (finalAudio.length > 1) {
        setProgress({
          status: "Merging audio files...",
          current: totalChunks,
          total: totalChunks,
          apiKeys: totalApiKeys,
        });

        try {
          const merged = await mergeAudioFiles(finalAudio);
          setMergedAudio(merged);
        } catch (mergeError) {
          console.error("Failed to merge audio:", mergeError);
        }
      }

      setProgress({
        status: "Complete",
        current: totalChunks,
        total: totalChunks,
        success: finalAudio.length,
        failed: chunkErrors.length,
      });
    } catch (error) {
      setErrors([{ error: error.message }]);
      setProgress({ status: "Failed", error: error.message });
    } finally {
      setIsGenerating(false);
    }
  };

  const mergeAudioFiles = async (audioFiles) => {
    // Decode all audio data and concatenate PCM samples
    const allSamples = [];

    for (const file of audioFiles) {
      const byteCharacters = atob(file.audioData);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      allSamples.push(new Uint8Array(byteNumbers));
    }

    // Calculate total length
    const totalLength = allSamples.reduce((sum, arr) => sum + arr.length, 0);

    // Concatenate all samples
    const mergedSamples = new Uint8Array(totalLength);
    let offset = 0;
    for (const samples of allSamples) {
      mergedSamples.set(samples, offset);
      offset += samples.length;
    }

    // Create WAV file
    const wavHeader = createWavHeader(mergedSamples.length, 24000, 1, 16);
    const wavFile = new Uint8Array(wavHeader.length + mergedSamples.length);
    wavFile.set(wavHeader, 0);
    wavFile.set(mergedSamples, wavHeader.length);

    const blob = new Blob([wavFile], { type: "audio/wav" });
    return URL.createObjectURL(blob);
  };

  const downloadAudio = (audioData, filename) => {
    const byteCharacters = atob(audioData);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);

    // Create WAV header for raw PCM data
    const wavHeader = createWavHeader(byteArray.length, 24000, 1, 16);
    const wavFile = new Uint8Array(wavHeader.length + byteArray.length);
    wavFile.set(wavHeader, 0);
    wavFile.set(byteArray, wavHeader.length);

    const blob = new Blob([wavFile], { type: "audio/wav" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadMergedAudio = () => {
    if (!mergedAudio) return;
    const a = document.createElement("a");
    a.href = mergedAudio;
    a.download = "speech_complete.wav";
    a.click();
  };

  const createWavHeader = (dataLength, sampleRate, channels, bitsPerSample) => {
    const header = new ArrayBuffer(44);
    const view = new DataView(header);

    // RIFF chunk descriptor
    writeString(view, 0, "RIFF");
    view.setUint32(4, 36 + dataLength, true);
    writeString(view, 8, "WAVE");

    // fmt sub-chunk
    writeString(view, 12, "fmt ");
    view.setUint32(16, 16, true); // Subchunk1Size
    view.setUint16(20, 1, true); // AudioFormat (PCM)
    view.setUint16(22, channels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * channels * (bitsPerSample / 8), true);
    view.setUint16(32, channels * (bitsPerSample / 8), true);
    view.setUint16(34, bitsPerSample, true);

    // data sub-chunk
    writeString(view, 36, "data");
    view.setUint32(40, dataLength, true);

    return new Uint8Array(header);
  };

  const writeString = (view, offset, string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };

  const createAudioUrl = (audioData) => {
    const byteCharacters = atob(audioData);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);

    const wavHeader = createWavHeader(byteArray.length, 24000, 1, 16);
    const wavFile = new Uint8Array(wavHeader.length + byteArray.length);
    wavFile.set(wavHeader, 0);
    wavFile.set(byteArray, wavHeader.length);

    const blob = new Blob([wavFile], { type: "audio/wav" });
    return URL.createObjectURL(blob);
  };

  return (
    <div className="app-container">
      <div className="main-content">
        {/* Header */}
        <header className="header">
          <h1 className="title">Google AI Text-to-Speech</h1>
          <p className="subtitle">
            Convert unlimited text to natural speech using Gemini 2.5 TTS
          </p>
          {apiKeyCount > 0 && (
            <div className="api-status">
              <span className="api-badge">
                {apiKeyCount} API Key{apiKeyCount > 1 ? "s" : ""} Configured
              </span>
            </div>
          )}
        </header>

        {/* Hidden audio element for background preview playback */}
        <audio 
          ref={previewAudioRef} 
          style={{ display: "none" }} 
          onEnded={() => {
            setPreviewAudio(null);
            setPreviewingVoice(null);
          }}
        />

        {/* Main Form */}
        <div className="form-container">
          {/* Voice Selection with Preview */}
          <div className="form-group">
            <label className="label">Voice</label>
            <div className="voice-grid">
              {VOICES.map((voice) => (
                <div
                  key={voice.name}
                  className={`voice-card ${selectedVoice === voice.name ? "selected" : ""} ${previewingVoice === voice.name ? "previewing" : ""}`}
                  onClick={() => setSelectedVoice(voice.name)}
                >
                  <div className="voice-info">
                    <span className="voice-name">{voice.name}</span>
                    <span className="voice-desc">{voice.description}</span>
                  </div>
                  <button
                    className={`preview-btn ${previewingVoice === voice.name && previewAudio ? "playing" : ""}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      handlePreviewVoice(voice.name);
                    }}
                    title={previewingVoice === voice.name && previewAudio ? "Stop" : "Preview"}
                  >
                    {previewingVoice === voice.name && !previewAudio ? (
                      <span className="mini-spinner"></span>
                    ) : previewingVoice === voice.name && previewAudio ? (
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                        <rect x="4" y="4" width="16" height="16" rx="2" />
                      </svg>
                    ) : (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                        <polygon points="5 3 19 12 5 21 5 3" />
                      </svg>
                    )}
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Style Instructions */}
          <div className="form-group">
            <label className="label">Style instructions</label>
            <input
              type="text"
              className="input"
              value={styleInstructions}
              onChange={(e) => setStyleInstructions(e.target.value)}
              placeholder="E.g., Read aloud in a warm and friendly tone"
            />
          </div>

          {/* Text Area */}
          <div className="form-group">
            <label className="label">
              Text
              <span className="word-count">
                {wordCount.toLocaleString()} words
                {estimatedChunks > 1 && ` • ${estimatedChunks} chunks`}
              </span>
            </label>
            <textarea
              className="textarea"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Start writing or paste text here to generate speech"
              rows={12}
            />
          </div>

          {/* Generate Button */}
          <button
            className={`generate-btn ${isGenerating ? "generating" : ""}`}
            onClick={handleGenerate}
            disabled={isGenerating || !text.trim() || apiKeyCount === 0}
          >
            {isGenerating ? (
              <>
                <span className="spinner"></span>
                Generating...
              </>
            ) : (
              <>
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
                Generate Speech
              </>
            )}
          </button>

          {apiKeyCount === 0 && (
            <p className="no-keys-warning">
              ⚠️ No API keys configured. Add API_KEY1, API_KEY2, etc. to your
              .env.local file
            </p>
          )}
        </div>

        {/* Progress Section */}
        {progress && (
          <div className="progress-section">
            <div className="progress-header">
              <span
                className={`status-badge ${progress.status === "Complete" ? "success" : progress.status === "Failed" ? "error" : "processing"}`}
              >
                {progress.status}
              </span>
              {progress.total > 0 && (
                <span className="chunk-info">
                  {progress.current}/{progress.total} audio files
                  {progress.currentKey && ` • Using Key ${progress.currentKey}`}
                </span>
              )}
            </div>
            {progress.total > 0 && (
              <div className="progress-bar-container">
                <div
                  className="progress-bar"
                  style={{
                    width: `${(progress.current / progress.total) * 100}%`,
                  }}
                ></div>
              </div>
            )}
            {progress.error && (
              <div className="error-message">{progress.error}</div>
            )}
          </div>
        )}

        {/* Merged Audio */}
        {mergedAudio && (
          <div className="merged-section">
            <h2 className="results-title">🎵 Complete Audio (Merged)</h2>
            <div className="merged-card">
              <audio controls className="audio-player" src={mergedAudio} />
              <button className="download-btn primary" onClick={downloadMergedAudio}>
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                Download Complete Audio
              </button>
            </div>
          </div>
        )}

        {/* Audio Results */}
        {audioFiles.length > 0 && (
          <div className="results-section">
            <h2 className="results-title">
              Individual Audio Files ({audioFiles.length})
            </h2>
            <div className="audio-grid">
              {audioFiles.map((file) => (
                <div key={file.index} className="audio-card">
                  <div className="audio-info">
                    <span className="chunk-label">{file.label}</span>
                    <span className="chunk-words">
                      {file.wordCount.toLocaleString()} words • Key{" "}
                      {file.keyUsed}
                    </span>
                  </div>
                  <audio
                    ref={(el) => (audioRefs.current[file.index] = el)}
                    controls
                    className="audio-player"
                    src={createAudioUrl(file.audioData)}
                  />
                  <button
                    className="download-btn"
                    onClick={() =>
                      downloadAudio(file.audioData, `audio_${file.index + 1}.wav`)
                    }
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="7 10 12 15 17 10" />
                      <line x1="12" y1="15" x2="12" y2="3" />
                    </svg>
                    Download
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Errors */}
        {errors.length > 0 && (
          <div className="errors-section">
            <h3 className="errors-title">Errors</h3>
            {errors.map((err, i) => (
              <div key={i} className="error-item">
                {err.label && `${err.label}: `}
                {err.error}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
