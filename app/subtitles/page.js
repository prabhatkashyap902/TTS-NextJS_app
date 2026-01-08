"use client";

import { useState, useRef } from "react";

export default function SubtitlesPage() {
  const [text, setText] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [srtContent, setSrtContent] = useState(null);
  const [error, setError] = useState(null);
  const [fileName, setFileName] = useState(null);
  const fileInputRef = useRef(null);

  const wordCount = text.trim() ? text.trim().split(/\s+/).filter(w => w.length > 0).length : 0;
  const charCount = text.trim().length;

  // Handle file upload
  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (!file.name.endsWith('.txt') && !file.type.includes('text')) {
      alert("Please upload a .txt file");
      return;
    }

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      setText(event.target?.result || "");
      setSrtContent(null);
    };
    reader.readAsText(file);
  };

  const handleGenerate = async () => {
    if (!text.trim()) { alert("Please enter or upload text"); return; }
    
    // Limit text to 2000 chars for subtitle generation (single chunk for accurate timing)
    const textToProcess = text.trim().slice(0, 10000);
    
    setIsGenerating(true);
    setError(null);
    setSrtContent(null);

    try {
      const response = await fetch("/api/ms-tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: textToProcess,
          voice: "en-US-GuyNeural",
          rate: "+0%",
          pitch: "+0Hz",
          includeSrt: true,
        }),
      });

      if (!response.ok) throw new Error((await response.json()).error || "Failed");
      
      const data = await response.json();
      setSrtContent(data.srt);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = () => {
    if (!srtContent) return;
    const blob = new Blob([srtContent], { type: 'text/srt' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const baseName = fileName ? fileName.replace('.txt', '') : 'subtitles';
    a.download = `${baseName}.srt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="app-container">
      <div className="main-content">
        <header className="header">
          <h1 className="title">📝 Subtitle Generator</h1>
          <p className="subtitle">Upload text file or paste text • Get SRT with 4-5 words per line</p>
          <a 
            href="/" 
            style={{
              marginTop: "0.75rem",
              display: "inline-flex",
              alignItems: "center",
              gap: "0.4rem",
              padding: "0.4rem 0.8rem",
              background: "rgba(99, 102, 241, 0.1)",
              border: "1px solid rgba(99, 102, 241, 0.3)",
              borderRadius: "20px",
              textDecoration: "none",
              fontSize: "0.75rem",
              color: "var(--primary)",
            }}
          >
            🎙️ Back to TTS
          </a>
        </header>

        <div className="form-container">
          {/* File Upload */}
          <div className="form-group">
            <label className="label">Upload Text File</label>
            <input 
              type="file" 
              ref={fileInputRef}
              accept=".txt,text/plain"
              onChange={handleFileUpload}
              style={{ display: "none" }}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              style={{
                width: "100%",
                padding: "1.5rem",
                border: "2px dashed var(--input-border)",
                borderRadius: "12px",
                background: "var(--input-bg)",
                cursor: "pointer",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "0.5rem",
                transition: "all 0.2s ease",
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.borderColor = "var(--primary)";
                e.currentTarget.style.background = "rgba(99, 102, 241, 0.05)";
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.borderColor = "var(--input-border)";
                e.currentTarget.style.background = "var(--input-bg)";
              }}
            >
              <span style={{ fontSize: "2rem" }}>📄</span>
              <span style={{ color: "var(--text)", fontWeight: "500" }}>
                {fileName ? `✅ ${fileName}` : "Click to upload .txt file"}
              </span>
              <span style={{ color: "var(--text-muted)", fontSize: "0.75rem" }}>
                or paste text below
              </span>
            </button>
          </div>

          {/* Text Input */}
          <div className="form-group">
            <label className="label">
              Text 
              <span className="word-count">{wordCount.toLocaleString()} words • {charCount.toLocaleString()} chars</span>
            </label>
            <textarea 
              className="textarea" 
              value={text} 
              onChange={(e) => { setText(e.target.value); setFileName(null); setSrtContent(null); }}
              placeholder="Upload a file above or paste your text here..."
              rows={10} 
            />
            {charCount > 10000 && (
              <p style={{ color: "#f59e0b", fontSize: "0.75rem", marginTop: "0.5rem" }}>
                ⚠️ Text will be limited to first 10,000 characters for accurate timing
              </p>
            )}
          </div>

          {/* Generating Indicator */}
          {isGenerating && (
            <div style={{ 
              display: "flex", 
              alignItems: "center", 
              justifyContent: "center",
              gap: "0.75rem",
              padding: "1rem",
              background: "rgba(99, 102, 241, 0.1)",
              borderRadius: "12px",
            }}>
              <div className="spinner" />
              <span style={{ color: "var(--primary)", fontSize: "0.9rem" }}>
                Processing text and generating accurate timestamps...
              </span>
            </div>
          )}

          {/* Generate Button */}
          <button 
            className="generate-btn" 
            onClick={handleGenerate} 
            disabled={!text.trim() || isGenerating}
          >
            {isGenerating ? "⏳ Generating..." : "📝 Generate SRT Subtitles"}
          </button>

          {/* Error */}
          {error && (
            <div className="errors-section">
              <div className="error-item">{error}</div>
            </div>
          )}

          {/* Result */}
          {srtContent && (
            <div className="merged-section" style={{ marginTop: "1.5rem" }}>
              <h2 className="results-title">✅ Subtitles Ready</h2>
              <div className="merged-card">
                <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: "0.75rem" }}>
                  {wordCount.toLocaleString()} words • ~{Math.ceil(wordCount / 5)} subtitle lines
                </p>
                <div style={{ 
                  background: "var(--input-bg)", 
                  padding: "1rem",
                  borderRadius: "8px", 
                  maxHeight: "200px", 
                  overflowY: "auto",
                  fontFamily: "monospace",
                  fontSize: "0.75rem",
                  whiteSpace: "pre-wrap",
                  color: "var(--text-muted)",
                }}>
                  {srtContent.slice(0, 1500)}{srtContent.length > 1500 ? "\n..." : ""}
                </div>
                <button 
                  className="download-btn primary" 
                  onClick={handleDownload} 
                  style={{ marginTop: "1rem", width: "100%" }}
                >
                  ⬇️ Download SRT File
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
