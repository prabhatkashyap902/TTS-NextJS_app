"use client";

import { useState, useEffect, useRef } from "react";
import { Play, Download, Loader2, Mic, Pause, StopCircle, RefreshCw, Wifi, WifiOff, Upload, ExternalLink, Zap } from "lucide-react";

const LANGUAGES = [
  { id: "English", name: "English", flag: "🇺🇸" },
  { id: "Chinese", name: "Chinese", flag: "🇨🇳" },
  { id: "Japanese", name: "Japanese", flag: "🇯🇵" },
  { id: "Korean", name: "Korean", flag: "🇰🇷" },
  { id: "German", name: "German", flag: "🇩🇪" },
  { id: "French", name: "French", flag: "🇫🇷" },
  { id: "Spanish", name: "Spanish", flag: "🇪🇸" },
  { id: "Italian", name: "Italian", flag: "🇮🇹" },
  { id: "Portuguese", name: "Portuguese", flag: "🇵🇹" },
  { id: "Russian", name: "Russian", flag: "🇷🇺" },
  { id: "Hindi", name: "Hindi", flag: "🇮🇳" },
  { id: "Arabic", name: "Arabic", flag: "🇸🇦" },
  { id: "Turkish", name: "Turkish", flag: "🇹🇷" },
  { id: "Polish", name: "Polish", flag: "🇵🇱" },
  { id: "Dutch", name: "Dutch", flag: "🇳🇱" },
  { id: "Czech", name: "Czech", flag: "🇨🇿" },
  { id: "Hungarian", name: "Hungarian", flag: "🇭🇺" },
];

export default function XTTSPage() {
  const [colabUrl, setColabUrl] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const [isCheckingConnection, setIsCheckingConnection] = useState(false);
  const [gpuInfo, setGpuInfo] = useState("");
  const [setupPlatform, setSetupPlatform] = useState("colab"); // "colab" or "kaggle"
  
  const [text, setText] = useState("Hello! I am XTTSv2, a fast voice cloning model. I can speak in 17 languages with just a few seconds of your voice!");
  const [language, setLanguage] = useState("English");
  
  const [refAudioFile, setRefAudioFile] = useState(null);
  const [refAudioUrl, setRefAudioUrl] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  
  const [status, setStatus] = useState("idle");
  const [elapsedTime, setElapsedTime] = useState(0);
  const [progress, setProgress] = useState(0);
  const [progressInfo, setProgressInfo] = useState("");
  const timerRef = useRef(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const [audioBlob, setAudioBlob] = useState(null);
  const [error, setError] = useState(null);
  
  const [playbackState, setPlaybackState] = useState('stopped');
  const audioRef = useRef(null);

  useEffect(() => {
    const savedUrl = localStorage.getItem('xtts_colab_url');
    if (savedUrl) {
      setColabUrl(savedUrl);
      checkConnection(savedUrl);
    }
  }, []);

  const checkConnection = async (url) => {
    if (!url) return;
    setIsCheckingConnection(true);
    
    try {
      const cleanUrl = url.replace(/\/$/, '');
      const response = await fetch(`${cleanUrl}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
        headers: { 'ngrok-skip-browser-warning': 'true', 'bypass-tunnel-reminder': 'true' },
      });
      
      if (response.ok) {
        const data = await response.json();
        setIsConnected(true);
        setGpuInfo(data.gpu || 'Connected');
        setColabUrl(cleanUrl);
        localStorage.setItem('xtts_colab_url', cleanUrl);
      } else {
        setIsConnected(false);
        setGpuInfo("");
      }
    } catch (e) {
      setIsConnected(false);
      setGpuInfo("");
    }
    setIsCheckingConnection(false);
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setRefAudioFile(file);
      setRefAudioUrl(URL.createObjectURL(file));
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      
      mediaRecorder.ondataavailable = (e) => audioChunksRef.current.push(e.data);
      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        setRefAudioFile(blob);
        setRefAudioUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach(t => t.stop());
      };
      
      mediaRecorder.start();
      setIsRecording(true);
    } catch (e) {
      setError("Microphone access denied");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleGenerate = async () => {
    if (!text || !isConnected) return;
    
    setAudioUrl(null);
    setAudioBlob(null);
    setError(null);
    setStatus("generating");
    setElapsedTime(0);
    setProgress(0);
    setProgressInfo("Preparing...");
    
    timerRef.current = setInterval(() => setElapsedTime(prev => prev + 1), 1000);
    
    try {
      let refAudioB64 = null;
      
      if (refAudioFile) {
        const arrayBuffer = await refAudioFile.arrayBuffer();
        const bytes = new Uint8Array(arrayBuffer);
        let binary = '';
        const chunkSize = 8192;
        for (let i = 0; i < bytes.length; i += chunkSize) {
          const chunk = bytes.subarray(i, i + chunkSize);
          binary += String.fromCharCode.apply(null, chunk);
        }
        refAudioB64 = btoa(binary);
      }
      
      const response = await fetch(`${colabUrl}/api/tts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true', 'bypass-tunnel-reminder': 'true' },
        body: JSON.stringify({ text, language, ref_audio: refAudioB64, stream: true }),
      });
      
      const contentType = response.headers.get('content-type') || '';
      
      if (contentType.includes('text/event-stream')) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n\n');
          buffer = lines.pop() || '';
          
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));
                
                if (data.type === 'progress') {
                  setProgress(data.percent || 0);
                  setProgressInfo(data.status || `${data.percent}%`);
                } else if (data.type === 'complete') {
                  const binaryString = atob(data.audio);
                  const bytes = new Uint8Array(binaryString.length);
                  for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
                  const blob = new Blob([bytes], { type: 'audio/wav' });
                  
                  setAudioBlob(blob);
                  setAudioUrl(URL.createObjectURL(blob));
                  setStatus("complete");
                  setProgress(100);
                  setProgressInfo(`Generated ${data.duration}s audio`);
                } else if (data.type === 'error') {
                  throw new Error(data.message);
                }
              } catch (parseError) {
                console.error('Parse error:', parseError);
              }
            }
          }
        }
      } else {
        if (!response.ok) throw new Error(`Server error: ${response.status}`);
        const blob = await response.blob();
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        setStatus("complete");
        setProgress(100);
      }
    } catch (e) {
      setError(e.message);
      setStatus("error");
    } finally {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    }
  };

  const handlePlay = () => {
    if (!audioRef.current || !audioUrl) return;
    if (playbackState === 'playing') {
      audioRef.current.pause();
      setPlaybackState('paused');
    } else {
      audioRef.current.src = audioUrl;
      audioRef.current.play();
      setPlaybackState('playing');
    }
  };

  const handleStop = () => {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current.currentTime = 0; }
    setPlaybackState('stopped');
  };

  const handleDownload = () => {
    if (!audioBlob) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(audioBlob);
    a.download = `xtts_${Date.now()}.wav`;
    a.click();
  };

  const clearRefAudio = () => {
    setRefAudioFile(null);
    setRefAudioUrl(null);
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-white p-4 md:p-8">
      <audio ref={audioRef} onEnded={() => setPlaybackState('stopped')} />
      
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="space-y-4 text-center mb-8">
          <h1 className="text-4xl font-bold bg-linear-to-r from-orange-400 to-red-500 bg-clip-text text-transparent inline-flex items-center gap-3">
            <Zap className="w-10 h-10 text-orange-400" />
            XTTSv2 Fast Clone
          </h1>
          <p className="text-gray-400 text-lg">
            ⚡ 2x Realtime • 17 Languages • 6-10s Voice Sample
          </p>
        </div>

        {/* Connection */}
        <div className={`rounded-2xl p-6 border transition-all ${isConnected ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-neutral-900/50 border-white/5'}`}>
          <div className="flex flex-col md:flex-row gap-4 items-start md:items-center">
            <div className="flex-1 w-full">
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 block">Colab API URL</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={colabUrl}
                  onChange={(e) => setColabUrl(e.target.value)}
                  placeholder="https://xxxx-xx-xx-xx-xx.ngrok-free.app"
                  className="flex-1 bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500/50 placeholder:text-gray-600 font-mono text-sm"
                />
                <button
                  onClick={() => checkConnection(colabUrl)}
                  disabled={isCheckingConnection || !colabUrl}
                  className="px-4 py-3 bg-orange-600 hover:bg-orange-500 disabled:opacity-50 rounded-lg text-sm font-medium flex items-center gap-2"
                >
                  {isCheckingConnection ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                  Connect
                </button>
              </div>
            </div>
            
            <div className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium ${isConnected ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
              {isConnected ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
              {isConnected ? gpuInfo : 'Disconnected'}
            </div>
          </div>
          
          {!isConnected && (
            <div className="mt-6 space-y-4">
              <div className="flex items-center justify-between">
                <p className="font-bold text-lg text-white">🚀 Setup Guide</p>
                
                {/* Platform Tabs */}
                <div className="flex bg-black/30 rounded-lg p-1">
                  <button
                    onClick={() => setSetupPlatform("colab")}
                    className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                      setupPlatform === "colab" 
                        ? "bg-orange-600 text-white" 
                        : "text-gray-400 hover:text-white"
                    }`}
                  >
                    Google Colab
                  </button>
                  <button
                    onClick={() => setSetupPlatform("kaggle")}
                    className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                      setupPlatform === "kaggle" 
                        ? "bg-amber-600 text-white" 
                        : "text-gray-400 hover:text-white"
                    }`}
                  >
                    Kaggle
                  </button>
                </div>
              </div>

              {/* Colab Instructions */}
              {setupPlatform === "colab" && (
                <>
                  <div className="p-4 bg-orange-500/10 rounded-xl border border-orange-500/20">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0">1</div>
                      <div className="flex-1">
                        <p className="font-medium text-orange-300 mb-2">Download the Colab Notebook</p>
                        <a href="/xtts_colab_3.ipynb" download="xtts_colab_3.ipynb" className="inline-flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-500 rounded-lg text-white text-sm font-medium">
                          <Download className="w-4 h-4" />
                          Download xtts_colab_3.ipynb
                        </a>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 bg-red-500/10 rounded-xl border border-red-500/20">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 bg-red-500 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0">2</div>
                      <div className="flex-1">
                        <p className="font-medium text-red-300 mb-2">Get ngrok Token</p>
                        <a href="https://dashboard.ngrok.com/get-started/your-authtoken" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-500 rounded-lg text-white text-sm font-medium">
                          <ExternalLink className="w-4 h-4" />
                          Get ngrok Token
                        </a>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 bg-green-500/10 rounded-xl border border-green-500/20">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0">3</div>
                      <div className="flex-1">
                        <p className="font-medium text-green-300 mb-2">Upload to Colab & Run</p>
                        <ol className="text-gray-400 text-sm space-y-1 list-decimal list-inside">
                          <li>Go to <a href="https://colab.research.google.com" target="_blank" rel="noopener noreferrer" className="text-green-400 underline">colab.research.google.com</a></li>
                          <li>Upload notebook → Select <strong className="text-green-300">T4 GPU</strong></li>
                          <li>Paste ngrok token → Run all cells (Ctrl+F9)</li>
                        </ol>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* Kaggle Instructions */}
              {setupPlatform === "kaggle" && (
                <>
                  <div className="p-4 bg-amber-500/10 rounded-xl border border-amber-500/20">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 bg-amber-500 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0">1</div>
                      <div className="flex-1">
                        <p className="font-medium text-amber-300 mb-2">Download the Kaggle Notebook</p>
                        <a href="/xtts_kaggle.ipynb" download="xtts_kaggle.ipynb" className="inline-flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-500 rounded-lg text-white text-sm font-medium">
                          <Download className="w-4 h-4" />
                          Download xtts_kaggle.ipynb
                        </a>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 bg-red-500/10 rounded-xl border border-red-500/20">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 bg-red-500 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0">2</div>
                      <div className="flex-1">
                        <p className="font-medium text-red-300 mb-2">Get ngrok Token</p>
                        <a href="https://dashboard.ngrok.com/get-started/your-authtoken" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-500 rounded-lg text-white text-sm font-medium">
                          <ExternalLink className="w-4 h-4" />
                          Get ngrok Token
                        </a>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 bg-cyan-500/10 rounded-xl border border-cyan-500/20">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 bg-cyan-500 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0">3</div>
                      <div className="flex-1">
                        <p className="font-medium text-cyan-300 mb-2">Upload to Kaggle & Configure</p>
                        <ol className="text-gray-400 text-sm space-y-1 list-decimal list-inside">
                          <li>Go to <a href="https://kaggle.com/notebooks" target="_blank" rel="noopener noreferrer" className="text-cyan-400 underline">kaggle.com</a> → Create → New Notebook</li>
                          <li>File → Import Notebook → Upload the file</li>
                          <li><strong className="text-yellow-300">⚠️ Verify phone</strong> in Settings for GPU</li>
                          <li>Settings → <strong className="text-cyan-300">Internet: ON</strong></li>
                          <li>Settings → <strong className="text-cyan-300">Accelerator: GPU T4 x2</strong></li>
                          <li>Edit ngrok token in Cell 3, run with Shift+Enter</li>
                        </ol>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* Step 4: Connect */}
              <div className="p-4 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-emerald-500 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0">4</div>
                  <div className="flex-1">
                    <p className="font-medium text-emerald-300 mb-2">Paste ngrok URL above & Connect!</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Main Content */}
        <div className={`bg-neutral-900/50 rounded-3xl p-8 border border-white/5 space-y-8 shadow-2xl ${!isConnected ? 'opacity-50 pointer-events-none' : ''}`}>
          
          {/* Voice Cloning */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Mic className="w-5 h-5 text-orange-400" />
              <h2 className="text-lg font-semibold text-white">Voice Cloning (6-10s sample)</h2>
            </div>
            
            <p className="text-sm text-gray-400">Upload or record 6-10 seconds of clear speech.</p>
            
            <div className="flex flex-wrap gap-3">
              <label className="px-4 py-2 bg-orange-600 hover:bg-orange-500 rounded-lg text-sm font-medium cursor-pointer flex items-center gap-2">
                <Upload className="w-4 h-4" />
                Upload Audio
                <input type="file" accept="audio/*" onChange={handleFileUpload} className="hidden" />
              </label>
              
              <button
                onClick={isRecording ? stopRecording : startRecording}
                className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 ${isRecording ? 'bg-red-600 hover:bg-red-500 animate-pulse' : 'bg-red-600 hover:bg-red-500'}`}
              >
                <Mic className="w-4 h-4" />
                {isRecording ? 'Stop Recording' : 'Record Voice'}
              </button>
              
              {refAudioFile && <button onClick={clearRefAudio} className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm font-medium">Clear</button>}
            </div>
            
            {refAudioUrl && (
              <div className="p-4 bg-orange-500/10 rounded-xl border border-orange-500/20">
                <p className="text-sm font-medium text-orange-300 mb-2">📎 Reference Audio Loaded</p>
                <audio src={refAudioUrl} controls className="w-full h-10" />
              </div>
            )}
          </div>

          {/* Language */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-gray-400 uppercase tracking-wider">Language</label>
            <div className="flex flex-wrap gap-2">
              {LANGUAGES.map((lang) => (
                <button
                  key={lang.id}
                  onClick={() => setLanguage(lang.id)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${language === lang.id ? 'bg-orange-600 text-white' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}
                >
                  {lang.flag} {lang.name}
                </button>
              ))}
            </div>
          </div>

          {/* Text Input */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-gray-400 uppercase tracking-wider ml-1">
              Text <span className="text-xs normal-case text-gray-600 ml-2">{text.length.toLocaleString()} chars</span>
            </label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="w-full bg-black/40 border border-white/10 rounded-xl p-6 text-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500/50 min-h-[200px] resize-y placeholder:text-gray-700 leading-relaxed text-lg"
              placeholder="Enter text to synthesize..."
            />
          </div>

          {/* Progress */}
          {status === 'generating' && (
            <div className="space-y-2 bg-black/20 p-4 rounded-xl border border-white/5">
              <div className="flex justify-between text-xs font-medium text-gray-400">
                <span className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {progressInfo || 'Generating...'}
                </span>
                <span className="text-orange-400 font-mono">
                  {progress}% • ⏱ {Math.floor(elapsedTime / 60).toString().padStart(2, '0')}:{(elapsedTime % 60).toString().padStart(2, '0')}
                </span>
              </div>
              <div className="h-3 bg-white/5 rounded-full overflow-hidden">
                <div className="h-full bg-linear-to-r from-orange-500 to-red-500 rounded-full transition-all duration-300" style={{ width: `${Math.max(progress, 5)}%` }} />
              </div>
            </div>
          )}

          {/* Generate Button */}
          <button
            onClick={handleGenerate}
            disabled={status === 'generating' || !text || !isConnected}
            className="w-full bg-linear-to-r from-orange-600 to-red-600 hover:from-orange-500 hover:to-red-500 disabled:opacity-50 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 shadow-lg text-lg"
          >
            {status === 'generating' ? <><Loader2 className="w-5 h-5 animate-spin" /> Generating...</> : <><Zap className="w-5 h-5" /> Generate Speech</>}
          </button>
          
          {error && <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm text-center">❌ {error}</div>}

          {/* Audio Player */}
          {audioUrl && status === 'complete' && (
            <div className="bg-linear-to-br from-orange-500/10 to-red-500/10 rounded-2xl p-6 border border-orange-500/20 space-y-4">
              <h3 className="font-semibold text-white">🎧 Generated Audio</h3>
              
              <div className="flex items-center gap-3">
                <button onClick={handlePlay} className="w-12 h-12 bg-orange-600 hover:bg-orange-500 rounded-full flex items-center justify-center">
                  {playbackState === 'playing' ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
                </button>
                
                <button onClick={handleStop} disabled={playbackState === 'stopped'} className="w-10 h-10 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 rounded-full flex items-center justify-center">
                  <StopCircle className="w-4 h-4" />
                </button>
                
                <button onClick={handleDownload} className="ml-auto px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-sm font-medium flex items-center gap-2">
                  <Download className="w-4 h-4" />
                  Download WAV
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
