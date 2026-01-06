"use client";

import { useState, useRef, useEffect } from "react";

/*
 * BROWSER WEB SPEECH API - 100% FREE, UNLIMITED, NO SERVER NEEDED!
 * Uses your browser's built-in speech synthesis
 */

export default function FreeTTSPage() {
  const [text, setText] = useState("");
  const [voices, setVoices] = useState([]);
  const [selectedVoice, setSelectedVoice] = useState(null);
  const [filter, setFilter] = useState("all");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [previewingVoice, setPreviewingVoice] = useState(null);
  const [error, setError] = useState(null);
  const [rate, setRate] = useState(1);
  const [pitch, setPitch] = useState(1);

  const synthRef = useRef(null);

  const wordCount = text.trim() ? text.trim().split(/\s+/).filter(w => w.length > 0).length : 0;
  const charCount = text.trim().length;

  // Load browser voices
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    synthRef.current = window.speechSynthesis;
    
    const loadVoices = () => {
      const availableVoices = synthRef.current.getVoices();
      if (availableVoices.length > 0) {
        // Prioritize English voices
        const sorted = availableVoices.sort((a, b) => {
          const aEn = a.lang.startsWith('en') ? 0 : 1;
          const bEn = b.lang.startsWith('en') ? 0 : 1;
          return aEn - bEn;
        });
        setVoices(sorted);
        // Default to first English voice
        const defaultVoice = sorted.find(v => v.lang.startsWith('en')) || sorted[0];
        setSelectedVoice(defaultVoice);
      }
    };

    loadVoices();
    synthRef.current.onvoiceschanged = loadVoices;

    return () => {
      if (synthRef.current) {
        synthRef.current.cancel();
      }
    };
  }, []);

  // Filter voices
  const filteredVoices = voices.filter(v => {
    if (filter === "english") return v.lang.startsWith('en');
    if (filter === "hindi") return v.lang.startsWith('hi');
    if (filter === "other") return !v.lang.startsWith('en') && !v.lang.startsWith('hi');
    return true;
  });

  // Preview voice
  const handlePreview = (voice) => {
    if (!synthRef.current) return;
    
    if (previewingVoice === voice.name) {
      synthRef.current.cancel();
      setPreviewingVoice(null);
      return;
    }

    synthRef.current.cancel();
    setPreviewingVoice(voice.name);

    const utterance = new SpeechSynthesisUtterance(`Hello, I'm ${voice.name}. I can convert your text to speech for free.`);
    utterance.voice = voice;
    utterance.rate = rate;
    utterance.pitch = pitch;
    utterance.onend = () => setPreviewingVoice(null);
    utterance.onerror = () => setPreviewingVoice(null);
    
    synthRef.current.speak(utterance);
  };

  // Speak text
  const handleSpeak = () => {
    if (!synthRef.current || !selectedVoice || !text.trim()) return;

    if (isSpeaking) {
      synthRef.current.cancel();
      setIsSpeaking(false);
      return;
    }

    setIsSpeaking(true);
    setError(null);

    const utterance = new SpeechSynthesisUtterance(text.trim());
    utterance.voice = selectedVoice;
    utterance.rate = rate;
    utterance.pitch = pitch;
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = (e) => {
      setError(e.error);
      setIsSpeaking(false);
    };

    synthRef.current.speak(utterance);
  };

  // Stop speaking
  const handleStop = () => {
    if (synthRef.current) {
      synthRef.current.cancel();
      setIsSpeaking(false);
      setPreviewingVoice(null);
    }
  };

  return (
    <div className="app-container">
      <div className="main-content">
        <header className="header">
          <h1 className="title">🎙️ Free Text-to-Speech</h1>
          <p className="subtitle">Browser Speech API • 100% FREE • Unlimited • No Server Needed</p>
          <div className="api-status">
            <span className="api-badge">✓ {voices.length} Voices</span>
            <span style={{ fontSize: "0.7rem", color: "#22c55e", background: "rgba(34, 197, 94, 0.1)", padding: "0.25rem 0.5rem", borderRadius: "10px", marginLeft: "0.5rem" }}>
              🆓 Works offline!
            </span>
          </div>
        </header>

        <div className="form-container">
          {/* Filter */}
          <div className="form-group">
            <label className="label">Filter</label>
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
              {[
                { value: "all", label: "🌐 All" },
                { value: "english", label: "🇬🇧 English" },
                { value: "hindi", label: "🇮🇳 Hindi" },
                { value: "other", label: "🌍 Other" },
              ].map((f) => (
                <button
                  key={f.value}
                  onClick={() => setFilter(f.value)}
                  style={{
                    padding: "0.5rem 1rem",
                    borderRadius: "20px",
                    border: filter === f.value ? "1px solid var(--primary)" : "1px solid var(--input-border)",
                    background: filter === f.value ? "rgba(99, 102, 241, 0.2)" : "var(--input-bg)",
                    color: filter === f.value ? "var(--primary)" : "var(--text-muted)",
                    cursor: "pointer",
                    fontSize: "0.875rem",
                  }}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Voice Grid */}
          <div className="form-group">
            <label className="label">
              Voice
              <span className="hint">{selectedVoice?.name || "Select a voice"}</span>
            </label>
            <div className="voice-grid">
              {filteredVoices.map((voice) => (
                <div
                  key={voice.name}
                  className={`voice-card ${selectedVoice?.name === voice.name ? "selected" : ""} ${previewingVoice === voice.name ? "previewing" : ""}`}
                  onClick={() => setSelectedVoice(voice)}
                >
                  <div className="voice-info">
                    <span className="voice-name">{voice.name}</span>
                    <span className="voice-desc">{voice.lang}</span>
                  </div>
                  <button
                    className={`preview-btn ${previewingVoice === voice.name ? "playing" : ""}`}
                    onClick={(e) => { e.stopPropagation(); handlePreview(voice); }}
                  >
                    {previewingVoice === voice.name ? (
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><rect x="4" y="4" width="16" height="16" rx="2" /></svg>
                    ) : (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3" /></svg>
                    )}
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Speed & Pitch Controls */}
          <div className="form-group" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
            <div>
              <label className="label">Speed: {rate.toFixed(1)}x</label>
              <input
                type="range"
                min="0.5"
                max="2"
                step="0.1"
                value={rate}
                onChange={(e) => setRate(parseFloat(e.target.value))}
                style={{ width: "100%" }}
              />
            </div>
            <div>
              <label className="label">Pitch: {pitch.toFixed(1)}</label>
              <input
                type="range"
                min="0.5"
                max="2"
                step="0.1"
                value={pitch}
                onChange={(e) => setPitch(parseFloat(e.target.value))}
                style={{ width: "100%" }}
              />
            </div>
          </div>

          {/* Text */}
          <div className="form-group">
            <label className="label">
              Text
              <span className="word-count">{wordCount} words • {charCount} chars</span>
            </label>
            <textarea
              className="textarea"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Enter your text here. This uses your browser's built-in speech synthesis - 100% free and works offline!"
              rows={10}
            />
          </div>

          {/* Controls */}
          <div style={{ display: "flex", gap: "1rem" }}>
            <button
              className={`generate-btn ${isSpeaking ? "generating" : ""}`}
              onClick={handleSpeak}
              disabled={!text.trim() || !selectedVoice}
              style={{ flex: 1 }}
            >
              {isSpeaking ? (
                <><span className="spinner"></span>Speaking...</>
              ) : (
                <><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="5 3 19 12 5 21 5 3" /></svg> Speak</>
              )}
            </button>
            {isSpeaking && (
              <button
                className="generate-btn"
                onClick={handleStop}
                style={{ background: "#ef4444", flex: 0.3 }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><rect x="4" y="4" width="16" height="16" rx="2" /></svg>
                Stop
              </button>
            )}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="errors-section">
            <h3 className="errors-title">Error</h3>
            <div className="error-item">{error}</div>
          </div>
        )}

        {/* Info */}
        <div style={{ marginTop: "2rem", padding: "1rem", background: "rgba(99, 102, 241, 0.1)", borderRadius: "12px", fontSize: "0.875rem", color: "var(--text-muted)" }}>
          <strong>💡 Note:</strong> This uses your browser&apos;s built-in speech synthesis. Available voices depend on your operating system. For downloadable audio files, use the Google Gemini TTS on the <a href="/" style={{ color: "var(--primary)" }}>home page</a>.
        </div>
      </div>
    </div>
  );
}
