"use client";

import { useState, useRef, useEffect } from "react";

const CATEGORIES = [
  { value: "narrator", label: "🎙️ Narrator", description: "Deep, professional voices" },
  { value: "news", label: "📰 Newscast", description: "Professional news voices" },
  { value: "casual", label: "💬 Casual", description: "Friendly voices" },
  { value: "indian", label: "🇮🇳 Indian", description: "Indian English" },
  { value: "hindi", label: "🇮🇳 Hindi", description: "Hindi language" },
  { value: "all", label: "📋 All", description: "All voices" },
];

const STYLE_PRESETS = [
  { id: "default", name: "Default", description: "Normal speed", rate: 0, pitch: 0, icon: "🎯" },
  { id: "slow-narrator", name: "Slow Narrator", description: "Audiobook style", rate: -20, pitch: -5, icon: "📖" },
  { id: "calm-storyteller", name: "Calm Storyteller", description: "Meditative", rate: -30, pitch: -10, icon: "🌙" },
  { id: "dramatic", name: "Dramatic", description: "Theatrical", rate: -15, pitch: 5, icon: "🎭" },
  { id: "fast-news", name: "Fast News", description: "News style", rate: 20, pitch: 0, icon: "📺" },
  { id: "conversational", name: "Conversational", description: "Casual chat", rate: 5, pitch: 5, icon: "💬" },
  { id: "deep-voice", name: "Deep & Powerful", description: "Authoritative", rate: -10, pitch: -20, icon: "🎸" },
  { id: "podcast", name: "Podcast Host", description: "Energetic", rate: 10, pitch: 5, icon: "🎧" },
];

function splitTextIntoChunks(text, maxChars = 2000) {
  const chunks = [];
  let remaining = text.trim();
  
  while (remaining.length > 0) {
    if (remaining.length <= maxChars) {
      chunks.push(remaining);
      break;
    }
    
    let breakPoint = maxChars;
    if (remaining[breakPoint] !== ' ' && remaining[breakPoint] !== '\n') {
      while (breakPoint < remaining.length && remaining[breakPoint] !== ' ' && remaining[breakPoint] !== '\n') {
        breakPoint++;
      }
    }
    
    chunks.push(remaining.substring(0, breakPoint).trim());
    remaining = remaining.substring(breakPoint).trim();
  }
  
  return chunks;
}

function formatTime(seconds) {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  if (hrs > 0) return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export default function MicrosoftTTSPage() {
  const [text, setText] = useState("");
  const [voices, setVoices] = useState([]);
  const [selectedVoice, setSelectedVoice] = useState(null);
  const [filter, setFilter] = useState("narrator");
  const [selectedStyle, setSelectedStyle] = useState(STYLE_PRESETS[1]);
  const [customRate, setCustomRate] = useState(0);
  const [customPitch, setCustomPitch] = useState(0);
  const [useCustom, setUseCustom] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedAudio, setGeneratedAudio] = useState(null);
  const [error, setError] = useState(null);
  const [loadingVoice, setLoadingVoice] = useState(null);
  const [playingVoice, setPlayingVoice] = useState(null);
  const [progress, setProgress] = useState({ current: 0, total: 0, percent: 0 });
  const [elapsedTime, setElapsedTime] = useState(0);
  const [showChunkPreview, setShowChunkPreview] = useState(false);
  const audioRef = useRef(null);
  const abortRef = useRef(false);
  const previewAbortRef = useRef(null);
  const timerRef = useRef(null);

  const wordCount = text.trim() ? text.trim().split(/\s+/).filter(w => w.length > 0).length : 0;
  const charCount = text.trim().length;
  const actualRate = useCustom ? customRate : selectedStyle.rate;
  const actualPitch = useCustom ? customPitch : selectedStyle.pitch;
  
  // Preview chunks for verification
  const previewChunks = text.trim() ? splitTextIntoChunks(text.trim()).map((chunk, i) => {
    const words = chunk.split(/\s+/);
    const first3 = words.slice(0, 3).join(' ');
    const last3 = words.slice(-3).join(' ');
    return { index: i + 1, chars: chunk.length, first3, last3 };
  }) : [];

  useEffect(() => {
    fetch("/api/ms-tts")
      .then(res => res.json())
      .then(data => {
        setVoices(data.voices || []);
        const defaultVoice = data.voices?.find(v => v.id === "en-US-GuyNeural") || data.voices?.[0];
        if (defaultVoice) setSelectedVoice(defaultVoice);
      })
      .catch(err => console.error("Failed to load voices:", err));
  }, []);

  // Warn user if they try to leave during generation
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (isGenerating) {
        e.preventDefault();
        e.returnValue = "Voice generation is in progress. Are you sure you want to leave?";
        return e.returnValue;
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isGenerating]);

  const filteredVoices = voices.filter(v => filter === "all" ? true : v.category === filter);

  const cleanupPreviousAudio = () => {
    if (generatedAudio?.url) URL.revokeObjectURL(generatedAudio.url);
    setGeneratedAudio(null);
  };

  const stopPreview = () => {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    if (previewAbortRef.current) { previewAbortRef.current.abort(); previewAbortRef.current = null; }
    setLoadingVoice(null);
    setPlayingVoice(null);
  };

  const handlePreview = async (voice) => {
    if (playingVoice === voice.id) { stopPreview(); return; }
    stopPreview();
    setLoadingVoice(voice.id);
    previewAbortRef.current = new AbortController();

    try {
      const response = await fetch("/api/ms-tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: `In a world where legends are born from whispers... I am ${voice.name}, your storyteller.`,
          voice: voice.id,
          rate: `${actualRate >= 0 ? '+' : ''}${actualRate}%`,
          pitch: `${actualPitch >= 0 ? '+' : ''}${actualPitch}Hz`,
        }),
        signal: previewAbortRef.current.signal,
      });

      if (!response.ok) throw new Error((await response.json()).error || "Failed");

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;
      
      audio.onplay = () => { setLoadingVoice(null); setPlayingVoice(voice.id); };
      audio.onended = () => { setPlayingVoice(null); URL.revokeObjectURL(url); };
      audio.onerror = () => { setLoadingVoice(null); setPlayingVoice(null); };
      
      audio.play();
    } catch (err) {
      if (err.name !== 'AbortError') alert(`Preview failed: ${err.message}`);
      setLoadingVoice(null);
    }
  };

  // Process chunk with API
  const processChunk = async (chunk, voiceId, rate, pitch) => {
    const response = await fetch("/api/ms-tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: chunk, voice: voiceId, rate, pitch }),
    });
    if (!response.ok) throw new Error((await response.json()).error || "Failed");
    return response.blob();
  };

  // Process chunks in parallel batches
  const handleGenerate = async () => {
    if (!text.trim()) { alert("Please enter text"); return; }
    cleanupPreviousAudio();
    abortRef.current = false;
    setIsGenerating(true);
    setError(null);
    setElapsedTime(0);
    setProgress({ current: 0, total: 0, percent: 0 });

    // Start timer
    const startTime = Date.now();
    timerRef.current = setInterval(() => {
      setElapsedTime(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);

    try {
      const chunks = splitTextIntoChunks(text.trim());
      const totalChunks = chunks.length;
      const audioBlobs = new Array(totalChunks);
      const BATCH_SIZE = 50; // Process 50 chunks at a time
      
      const rate = `${actualRate >= 0 ? '+' : ''}${actualRate}%`;
      const pitch = `${actualPitch >= 0 ? '+' : ''}${actualPitch}Hz`;
      const voiceId = selectedVoice?.id || "en-US-GuyNeural";

      setProgress({ current: 0, total: totalChunks, percent: 0 });

      // Process in batches
      for (let batchStart = 0; batchStart < totalChunks; batchStart += BATCH_SIZE) {
        if (abortRef.current) throw new Error("Generation cancelled");

        const batchEnd = Math.min(batchStart + BATCH_SIZE, totalChunks);
        const batchPromises = [];

        // Create promises for this batch (preserving order via index)
        for (let i = batchStart; i < batchEnd; i++) {
          const index = i;
          batchPromises.push(
            processChunk(chunks[index], voiceId, rate, pitch)
              .then(blob => { audioBlobs[index] = blob; })
          );
        }

        // Wait for all in batch to complete
        await Promise.all(batchPromises);

        // Update progress
        const completed = batchEnd;
        setProgress({
          current: completed,
          total: totalChunks,
          percent: Math.round((completed / totalChunks) * 100),
        });
      }

      // Stop timer
      clearInterval(timerRef.current);
      const finalTime = Math.floor((Date.now() - startTime) / 1000);
      setElapsedTime(finalTime);

      // Combine all blobs in order
      const combinedBlob = new Blob(audioBlobs, { type: "audio/mpeg" });
      setGeneratedAudio({
        url: URL.createObjectURL(combinedBlob),
        blob: combinedBlob,
        wordCount, charCount,
        voice: selectedVoice?.name || "Unknown",
        style: useCustom ? "Custom" : selectedStyle.name,
        chunks: totalChunks,
        duration: finalTime,
      });
    } catch (err) {
      clearInterval(timerRef.current);
      if (err.message !== "Generation cancelled") setError(err.message);
    } finally {
      setIsGenerating(false);
      setProgress({ current: 0, total: 0, percent: 0 });
    }
  };

  const handleCancel = () => { 
    abortRef.current = true; 
    clearInterval(timerRef.current);
  };
  
  const handleDownload = () => {
    if (!generatedAudio) return;
    const a = document.createElement("a");
    a.href = generatedAudio.url;
    a.download = `speech_${selectedVoice?.name}_${selectedStyle?.id || "custom"}.mp3`;
    a.click();
  };

  return (
    <div className="app-container">
      <div className="main-content">
        <header className="header">
          <h1 className="title">🎙️ Microsoft Neural TTS</h1>
          <p className="subtitle">Premium Neural Voices • Style Presets • Unlimited • FREE</p>
          <div className="api-status">
            <span className="api-badge">✓ {voices.length} Voices</span>
            <span style={{ fontSize: "0.7rem", color: "#22c55e", background: "rgba(34, 197, 94, 0.1)", padding: "0.25rem 0.5rem", borderRadius: "10px", marginLeft: "0.5rem" }}>⚡ 50x Parallel</span>
          </div>
        </header>

        <div className="form-container">
          {/* Selected Voice Display */}
          {selectedVoice && (
            <div style={{ padding: "1rem", background: "linear-gradient(135deg, rgba(99, 102, 241, 0.15), rgba(139, 92, 246, 0.1))", borderRadius: "12px", marginBottom: "1rem", border: "1px solid rgba(99, 102, 241, 0.3)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>Selected Voice</div>
                  <div style={{ fontSize: "1.1rem", fontWeight: "700", color: "var(--text)" }}>{selectedVoice.name}</div>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{selectedVoice.gender} • {selectedVoice.lang}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>Style: {useCustom ? "Custom" : selectedStyle.name}</div>
                  <div style={{ fontSize: "0.75rem", color: "var(--primary)", fontWeight: "600" }}>
                    Speed: {actualRate >= 0 ? '+' : ''}{actualRate}% | Pitch: {actualPitch >= 0 ? '+' : ''}{actualPitch}Hz
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Style Presets */}
          <div className="form-group">
            <label className="label">Reading Style</label>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: "0.5rem" }}>
              {STYLE_PRESETS.map((style) => (
                <button key={style.id} onClick={() => { setSelectedStyle(style); setUseCustom(false); }}
                  style={{ padding: "0.6rem", borderRadius: "10px", border: !useCustom && selectedStyle.id === style.id ? "2px solid var(--primary)" : "1px solid var(--input-border)", background: !useCustom && selectedStyle.id === style.id ? "rgba(99, 102, 241, 0.15)" : "var(--input-bg)", cursor: "pointer", textAlign: "left" }}>
                  <div style={{ fontSize: "1.1rem" }}>{style.icon}</div>
                  <div style={{ fontSize: "0.75rem", fontWeight: "600", color: "var(--text)" }}>{style.name}</div>
                  <div style={{ fontSize: "0.6rem", color: "var(--text-muted)" }}>{style.description}</div>
                  <div style={{ fontSize: "0.55rem", color: "var(--primary)", marginTop: "0.25rem", fontFamily: "monospace" }}>
                    {style.rate >= 0 ? '+' : ''}{style.rate}% | {style.pitch >= 0 ? '+' : ''}{style.pitch}Hz
                  </div>
                </button>
              ))}
              <button onClick={() => setUseCustom(true)}
                style={{ padding: "0.6rem", borderRadius: "10px", border: useCustom ? "2px solid var(--primary)" : "1px solid var(--input-border)", background: useCustom ? "rgba(99, 102, 241, 0.15)" : "var(--input-bg)", cursor: "pointer", textAlign: "left" }}>
                <div style={{ fontSize: "1.1rem" }}>⚙️</div>
                <div style={{ fontSize: "0.75rem", fontWeight: "600", color: "var(--text)" }}>Custom</div>
                <div style={{ fontSize: "0.6rem", color: "var(--text-muted)" }}>Set your own</div>
              </button>
            </div>
          </div>

          {useCustom && (
            <div className="form-group" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", background: "rgba(99, 102, 241, 0.05)", padding: "1rem", borderRadius: "12px" }}>
              <div>
                <label className="label">Speed: {customRate >= 0 ? '+' : ''}{customRate}%</label>
                <input type="range" min="-50" max="100" step="5" value={customRate} onChange={(e) => setCustomRate(parseInt(e.target.value))} style={{ width: "100%" }} />
              </div>
              <div>
                <label className="label">Pitch: {customPitch >= 0 ? '+' : ''}{customPitch}Hz</label>
                <input type="range" min="-50" max="50" step="5" value={customPitch} onChange={(e) => setCustomPitch(parseInt(e.target.value))} style={{ width: "100%" }} />
              </div>
            </div>
          )}

          {/* Voice Selection */}
          <div className="form-group">
            <label className="label">Voice</label>
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.5rem" }}>
              {CATEGORIES.map((cat) => (
                <button key={cat.value} onClick={() => setFilter(cat.value)}
                  style={{ padding: "0.4rem 0.8rem", borderRadius: "16px", border: filter === cat.value ? "1px solid var(--primary)" : "1px solid var(--input-border)", background: filter === cat.value ? "rgba(99, 102, 241, 0.2)" : "var(--input-bg)", color: filter === cat.value ? "var(--primary)" : "var(--text-muted)", cursor: "pointer", fontSize: "0.75rem" }}>
                  {cat.label}
                </button>
              ))}
            </div>
            <div className="voice-grid" style={{ maxHeight: "200px", overflowY: "auto" }}>
              {filteredVoices.map((voice) => (
                <div key={voice.id}
                  className={`voice-card ${selectedVoice?.id === voice.id ? "selected" : ""}`}
                  onClick={() => setSelectedVoice(voice)}
                  style={{ 
                    ...(voice.featured ? { borderColor: "rgba(34, 197, 94, 0.5)", background: "rgba(34, 197, 94, 0.08)" } : {}),
                    ...(selectedVoice?.id === voice.id ? { borderColor: "var(--primary)", background: "rgba(99, 102, 241, 0.15)", boxShadow: "0 0 0 2px rgba(99, 102, 241, 0.3)" } : {})
                  }}>
                  <div className="voice-info">
                    <span className="voice-name">{voice.name}</span>
                    <span className="voice-desc">{voice.gender} • {voice.lang}</span>
                  </div>
                  <button
                    className={`preview-btn ${playingVoice === voice.id ? "playing" : ""}`}
                    onClick={(e) => { e.stopPropagation(); handlePreview(voice); }}
                    style={{ minWidth: "32px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {loadingVoice === voice.id ? (
                      <span className="spinner" style={{ width: "12px", height: "12px" }}></span>
                    ) : playingVoice === voice.id ? "⏹" : "▶"}
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Text Input */}
          <div className="form-group">
            <label className="label">Text <span className="word-count">{wordCount.toLocaleString()} words • {charCount.toLocaleString()} chars • ~{previewChunks.length} chunks</span></label>
            <textarea className="textarea" value={text} onChange={(e) => setText(e.target.value)}
              placeholder="Paste your text here - unlimited characters. Processing uses 50x parallel for speed!"
              rows={10} />
            
            {/* Chunk Preview Toggle */}
            {text.trim() && previewChunks.length > 1 && (
              <button 
                onClick={() => setShowChunkPreview(!showChunkPreview)}
                style={{ marginTop: "0.5rem", padding: "0.4rem 0.8rem", fontSize: "0.75rem", background: "var(--input-bg)", border: "1px solid var(--input-border)", borderRadius: "8px", cursor: "pointer", color: "var(--text-muted)" }}>
                {showChunkPreview ? "🔼 Hide" : "🔽 Show"} Chunk Preview ({previewChunks.length} chunks)
              </button>
            )}
          </div>

          {/* Chunk Preview - Verify Order */}
          {showChunkPreview && previewChunks.length > 0 && (
            <div className="form-group" style={{ background: "var(--input-bg)", padding: "1rem", borderRadius: "12px", maxHeight: "200px", overflowY: "auto" }}>
              <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginBottom: "0.5rem" }}>
                ✅ Verify chunk order: Each row shows first 3 → last 3 words
              </div>
              {previewChunks.map((chunk) => (
                <div key={chunk.index} style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.3rem 0", borderBottom: "1px solid var(--input-border)", fontSize: "0.7rem" }}>
                  <span style={{ minWidth: "40px", color: "var(--primary)", fontWeight: "600" }}>#{chunk.index}</span>
                  <span style={{ color: "var(--text-muted)" }}>{chunk.chars} chars</span>
                  <span style={{ flex: 1, color: "var(--text)" }}>
                    <strong>{chunk.first3}</strong>
                    <span style={{ color: "var(--text-muted)" }}> ... </span>
                    <strong>{chunk.last3}</strong>
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Progress */}
          {isGenerating && (
            <div className="form-group">
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                  Chunk {progress.current}/{progress.total} (50 parallel)
                </span>
                <span style={{ fontSize: "0.8rem", fontWeight: "600", color: "var(--primary)" }}>
                  {progress.percent}% • ⏱️ {formatTime(elapsedTime)}
                </span>
              </div>
              <div style={{ width: "100%", height: "8px", background: "var(--input-bg)", borderRadius: "4px", overflow: "hidden" }}>
                <div style={{ width: `${progress.percent}%`, height: "100%", background: "linear-gradient(90deg, #6366f1, #8b5cf6)", transition: "width 0.3s" }} />
              </div>
            </div>
          )}

          {/* Generate Button */}
          {!isGenerating ? (
            <button className="generate-btn" onClick={handleGenerate} disabled={!text.trim()}>
              ⚡ Generate with &quot;{useCustom ? "Custom" : selectedStyle.name}&quot; style (50x parallel)
            </button>
          ) : (
            <button className="generate-btn" onClick={handleCancel} style={{ background: "#ef4444" }}>⏹ Cancel</button>
          )}
        </div>

        {/* Result */}
        {generatedAudio && (
          <div className="merged-section">
            <h2 className="results-title">🎵 Generated Audio</h2>
            <div className="merged-card">
              <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: "0.75rem" }}>
                {generatedAudio.voice} • {generatedAudio.style} • {generatedAudio.wordCount.toLocaleString()} words • {generatedAudio.chunks} chunks
                <br />
                <span style={{ color: "var(--primary)" }}>⏱️ Generated in {formatTime(generatedAudio.duration)}</span>
              </p>
              <audio controls src={generatedAudio.url} style={{ width: "100%" }} />
              <button className="download-btn primary" onClick={handleDownload} style={{ marginTop: "1rem", width: "100%" }}>⬇️ Download MP3</button>
            </div>
          </div>
        )}

        {error && <div className="errors-section"><div className="error-item">{error}</div></div>}

        <div style={{ marginTop: "2rem", textAlign: "center" }}>
          <a href="/" style={{ color: "var(--primary)", fontSize: "0.8rem" }}>← Google Gemini TTS</a>
        </div>
      </div>
    </div>
  );
}
