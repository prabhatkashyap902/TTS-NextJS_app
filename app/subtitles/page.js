"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { 
  initMixpanel, 
  trackPageView, 
  trackFileUpload, 
  trackTranscriptionStart, 
  trackTranscriptionSuccess, 
  trackDownload,
  trackClick
} from "@/lib/mixpanel";

// Helper to convert Whisper JSON to SRT format
function convertToSrt(chunks) {
  return chunks.map((chunk, index) => {
    const start = formatTime(chunk.timestamp[0]);
    const end = formatTime(chunk.timestamp[1]);
    return `${index + 1}\n${start} --> ${end}\n${chunk.text.trim()}\n`;
  }).join("\n");
}

function formatTime(seconds) {
  const date = new Date(seconds * 1000);
  const hh = String(Math.floor(seconds / 3600)).padStart(2, '0');
  const mm = String(date.getUTCMinutes()).padStart(2, '0');
  const ss = String(date.getUTCSeconds()).padStart(2, '0');
  const ms = String(date.getUTCMilliseconds()).padStart(3, '0');
  return `${hh}:${mm}:${ss},${ms}`;
}

export default function SubtitlesPage() {
  const [audioFile, setAudioFile] = useState(null);
  const [status, setStatus] = useState("idle"); // idle, loading_model, processing, complete, error
  const [progress, setProgress] = useState(0); // Model download progress
  const [srtContent, setSrtContent] = useState(null);
  const [logs, setLogs] = useState([]);
  
  const worker = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    // Initialize worker
    if (!worker.current) {
      // Use string path for public directory worker to avoid module resolution issues
      worker.current = new Worker("/worker.js", {
        type: "module",
      });

      worker.current.addEventListener("message", (e) => {
        const { type, data, result, error } = e.data;
        
        if (type === "download") {
            if (data.status === "progress") {
                setStatus("loading_model");
                setProgress(Math.round(data.progress || 0));
            } else if (data.status === "done") {
                setStatus("processing");
            }
        } else if (type === "complete") {
            setStatus("complete");
            setLogs(prev => [...prev, "✅ Transcription complete!"]);
            
             // ... processing result ...
            let srt = "";
            if (result.chunks) {
                srt = convertToSrt(result.chunks);
            } else {
                srt = `1\n00:00:00,000 --> 00:00:10,000\n${result.text}`;
            }
            setSrtContent(srt);
            trackTranscriptionSuccess(0, result.text ? result.text.split(' ').length : 0);
        } else if (type === "error") {
            setStatus("error");
            setLogs(prev => [...prev, "❌ Error: " + error]);
            alert(`Error: ${error}`);
        } else if (type === "log") {
            setLogs(prev => [...prev, "worker: " + data]);
        }
      });
    }
    
    return () => worker.current?.terminate();
  }, []);

  useEffect(() => {
    initMixpanel();
    trackPageView('Subtitles Generator');
  }, []);

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) {
        setAudioFile(file);
        setSrtContent(null);
        setStatus("idle");
        trackFileUpload(file.type, file.size);
    }
  };

  const handleProcess = async () => {
    if (!audioFile || !worker.current) return;
    
    setStatus("loading_model");
    trackTranscriptionStart(audioFile.type, audioFile.size);
    
    // Read file
    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const arrayBuffer = e.target.result;
            
            // 1. Decode original audio (e.g. 44.1kHz or 48kHz)
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const decoded = await audioContext.decodeAudioData(arrayBuffer);
            
            // 2. Resample to 16000Hz (Required for Whisper)
            const targetSampleRate = 16000;
            const offlineContext = new OfflineAudioContext(1, decoded.duration * targetSampleRate, targetSampleRate);
            const source = offlineContext.createBufferSource();
            source.buffer = decoded;
            source.connect(offlineContext.destination);
            source.start(0);
            
            const renderedBuffer = await offlineContext.startRendering();
            const audioData = renderedBuffer.getChannelData(0);
            
            // 3. Send to worker
            worker.current.postMessage({
                type: "transcribe",
                audio: audioData
            });
        } catch (err) {
            console.error("Audio processing error:", err);
            setStatus("error");
            alert("Failed to process audio file. It might be corrupt or an unsupported format.");
        }
    };
    reader.readAsArrayBuffer(audioFile);
  };

  const handleDownload = () => {
    if (!srtContent) return;
    const blob = new Blob([srtContent], { type: 'text/srt' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${audioFile?.name.replace(/\.[^/.]+$/, "") || "subtitles"}.srt`;
    trackDownload('Whisper', 'SRT', srtContent.split(/\s+/).length);
    a.click();
  };

  return (
    <div className="app-container">
      <div className="main-content">
        <header className="header" style={{ textAlign: "center" }}>
          <h1 className="title">🎙️ Audio to Subtitles</h1>
          <p className="subtitle">Upload Audio/Video • Local AI Transcription (Whisper) • 100% Free</p>
        </header>

        <div className="form-container">
           {/* File Upload */}
           <div className="form-group upload-box" 
                onClick={() => fileInputRef.current?.click()}
                style={{
                    border: audioFile ? "2px solid #22c55e" : "2px dashed var(--input-border)",
                    padding: "2rem",
                    borderRadius: "12px",
                    textAlign: "center",
                    cursor: "pointer",
                    background: audioFile ? "rgba(34, 197, 94, 0.05)" : "var(--input-bg)",
                    transition: "all 0.2s ease"
                }}
            >
                <input 
                    type="file" 
                    ref={fileInputRef} 
                    accept="audio/*,video/*" 
                    onChange={handleFileSelect} 
                    style={{display: "none"}}
                />
                <div style={{fontSize: "2.5rem", marginBottom: "0.5rem"}}>
                    {audioFile ? "✅" : "📂"}
                </div>
                <h3 style={{margin: 0, color: "var(--text)"}}>
                    {audioFile ? audioFile.name : "Click to Upload Audio or Video"}
                </h3>
                <p style={{margin: "0.5rem 0 0", color: "var(--text-muted)", fontSize: "0.8rem"}}>
                    {audioFile ? "Ready to transcribe" : "Supported: MP3, WAV, MP4, WEBM (Runs locally in browser)"}
                </p>
           </div>

           {/* Actions */}
           <div style={{marginTop: "1.5rem", textAlign: "center"}}>
               <button 
                  className="generate-btn" 
                  onClick={handleProcess}
                  disabled={!audioFile || (status !== "idle" && status !== "complete" && status !== "error")}
                  style={{maxWidth: "300px", margin: "0 auto"}}
               >
                   {status === "idle" ? "✨ Generate Subtitles" : 
                    status === "loading_model" ? `📥 Downloading AI... ${progress > 0 ? `(${progress}%)` : ''}` :
                    status === "processing" ? "⚙️ Transcribing Audio..." :
                    status === "complete" ? "✅ Done! Scroll down for SRT" : "Retry"}
               </button>
           </div>

           {/* Result */}
           {srtContent && (
             <div 
                className="merged-section" 
                style={{marginTop: "2rem"}}
                ref={(el) => {
                    // Auto-scroll to results when they appear
                    if (el && status === "complete") {
                        el.scrollIntoView({ behavior: "smooth", block: "start" });
                    }
                }}
             >
                 <h2 className="results-title">📝 Generated Subtitles</h2>
                 <div className="merged-card">
                     <textarea 
                        value={srtContent}
                        readOnly
                        style={{
                            width: "100%",
                            height: "200px",
                            background: "rgba(0,0,0,0.1)",
                            border: "1px solid var(--input-border)",
                            borderRadius: "8px",
                            padding: "1rem",
                            color: "var(--text-muted)",
                            fontFamily: "monospace",
                            fontSize: "0.8rem",
                            resize: "vertical"
                        }}
                     />
                     <button className="download-btn primary" onClick={handleDownload} style={{marginTop: "1rem", width: "100%"}}>
                        ⬇️ Download .SRT File
                     </button>
                 </div>
             </div>
           )}
           {/* Debug Logs */}
           <div style={{marginTop: "2rem", borderTop: "1px solid var(--border)", paddingTop: "1rem"}}>
              <details>
                  <summary style={{cursor: "pointer", color: "var(--text-muted)", fontSize: "0.8rem"}}>Debug Logs</summary>
                  <div style={{
                      background: "#1e1e1e", 
                      color: "#00ff00", 
                      padding: "1rem", 
                      borderRadius: "8px", 
                      marginTop: "0.5rem",
                      fontFamily: "monospace",
                      fontSize: "0.7rem",
                      maxHeight: "150px",
                      overflowY: "auto"
                  }}>
                      {logs.length === 0 ? "Waiting for action..." : logs.map((l, i) => <div key={i}>{l}</div>)}
                  </div>
              </details>
           </div>
        </div>

        {/* Info Section */}
        <div style={{
            marginTop: "4rem",
            padding: "2rem",
            background: "#fff",
            borderRadius: "12px",
            border: "1px solid var(--border)",
            boxShadow: "0 4px 12px rgba(0,0,0,0.05)"
        }}>
            <h2 style={{ fontSize: "1.5rem", marginBottom: "1.5rem", color: "var(--text)" }}>About Audio to Subtitles</h2>
            
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "2rem" }}>
                <div>
                   <h3 style={{ fontSize: "1.1rem", fontWeight: "600", marginBottom: "0.5rem", color: "var(--primary)" }}>🤖 Powered by Whisper</h3>
                   <p style={{ color: "var(--text-muted)", lineHeight: "1.6" }}>
                       We use OpenAI's Whisper model technology optimized for the browser. This provides state-of-the-art accuracy in transcription and translation.
                   </p>
                </div>
                <div>
                   <h3 style={{ fontSize: "1.1rem", fontWeight: "600", marginBottom: "0.5rem", color: "var(--primary)" }}>🔒 Private & Secure</h3>
                   <p style={{ color: "var(--text-muted)", lineHeight: "1.6" }}>
                       Your audio files are processed locally on your machine. We do not upload your personal recordings to any cloud server.
                   </p>
                </div>
                <div>
                   <h3 style={{ fontSize: "1.1rem", fontWeight: "600", marginBottom: "0.5rem", color: "var(--primary)" }}>🎬 Multiple Formats</h3>
                   <p style={{ color: "var(--text-muted)", lineHeight: "1.6" }}>
                       Support for nearly all audio and video formats including MP3, WAV, MP4, MKV, and WEBM. Get standard .SRT files compatible with YouTube, VLC, and Premiere Pro.
                   </p>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
}
