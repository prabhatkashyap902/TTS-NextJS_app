"use client";

import { useState, useEffect, useRef } from "react";
import { Play, Download, Loader2, Cloud, Settings, Pause, StopCircle, RefreshCw, Wifi, WifiOff, Copy, Check, ExternalLink } from "lucide-react";
import {
  initMixpanel,
  trackPageView,
  trackVoiceSelect,
  trackGenerationStart,
  trackGenerationSuccess,
  trackGenerationError,
  trackDownload,
  trackVoicePreview
} from "@/lib/mixpanel";

// Voice Data with Metadata (same as local-tts)
const KOKORO_VOICES = [
  // US Females
  { id: "af_bella", name: "Bella", gender: "Female", lang: "en-us", flag: "🇺🇸" },
  { id: "af_nicole", name: "Nicole", gender: "Female", lang: "en-us", flag: "🇺🇸" },
  { id: "af_sarah", name: "Sarah", gender: "Female", lang: "en-us", flag: "🇺🇸" },
  { id: "af_sky", name: "Sky", gender: "Female", lang: "en-us", flag: "🇺🇸" },
  { id: "af_heart", name: "Heart", gender: "Female", lang: "en-us", flag: "🇺🇸" },
  { id: "af_alloy", name: "Alloy", gender: "Female", lang: "en-us", flag: "🇺🇸" },
  { id: "af_aoede", name: "Aoede", gender: "Female", lang: "en-us", flag: "🇺🇸" },
  { id: "af_jessica", name: "Jessica", gender: "Female", lang: "en-us", flag: "🇺🇸" },
  { id: "af_kore", name: "Kore", gender: "Female", lang: "en-us", flag: "🇺🇸" },
  // US Males
  { id: "am_adam", name: "Adam", gender: "Male", lang: "en-us", flag: "🇺🇸" },
  { id: "am_michael", name: "Michael", gender: "Male", lang: "en-us", flag: "🇺🇸" },
  { id: "am_echo", name: "Echo", gender: "Male", lang: "en-us", flag: "🇺🇸" },
  { id: "am_eric", name: "Eric", gender: "Male", lang: "en-us", flag: "🇺🇸" },
  { id: "am_fenrir", name: "Fenrir", gender: "Male", lang: "en-us", flag: "🇺🇸" },
  { id: "am_liam", name: "Liam", gender: "Male", lang: "en-us", flag: "🇺🇸" },
  { id: "am_onyx", name: "Onyx", gender: "Male", lang: "en-us", flag: "🇺🇸" },
  { id: "am_puck", name: "Puck", gender: "Male", lang: "en-us", flag: "🇺🇸" },
  // UK
  { id: "bf_emma", name: "Emma", gender: "Female", lang: "en-gb", flag: "🇬🇧" },
  { id: "bf_isabella", name: "Isabella", gender: "Female", lang: "en-gb", flag: "🇬🇧" },
  { id: "bm_george", name: "George", gender: "Male", lang: "en-gb", flag: "🇬🇧" },
  { id: "bm_lewis", name: "Lewis", gender: "Male", lang: "en-gb", flag: "🇬🇧" },
];

const STYLE_PRESETS = [
  { id: "default", name: "Default", description: "Normal speed", speed: 1.0, pitch: 1.0, icon: "🎯" },
  { id: "slow-narrator", name: "Slow Narrator", description: "Audiobook style", speed: 0.8, pitch: 0.90, icon: "📖" },
  { id: "calm-storyteller", name: "Calm Storyteller", description: "Meditative", speed: 0.7, pitch: 0.92, icon: "🌙" },
  { id: "dramatic", name: "Dramatic", description: "Theatrical", speed: 0.9, pitch: 1.08, icon: "🎭" },
  { id: "fast-news", name: "Fast News", description: "News style", speed: 1.2, pitch: 1.0, icon: "📺" },
  { id: "conversational", name: "Conversational", description: "Casual chat", speed: 1.05, pitch: 1.05, icon: "💬" },
  { id: "deep-voice", name: "Deep & Powerful", description: "Authoritative", speed: 0.9, pitch: 0.75, icon: "🎸" },
  { id: "podcast", name: "Podcast Host", description: "Energetic", speed: 1.1, pitch: 1.08, icon: "🎧" },
];

export default function CloudTTSPage() {
  // Colab Connection
  const [colabUrl, setColabUrl] = useState("https://inimitable-daringly-junita.ngrok-free.dev");
  const [isConnected, setIsConnected] = useState(false);
  const [isCheckingConnection, setIsCheckingConnection] = useState(false);
  const [gpuInfo, setGpuInfo] = useState("");
  const [urlCopied, setUrlCopied] = useState(false);
  const [setupPlatform, setSetupPlatform] = useState("colab"); // "colab" or "kaggle"
  
  const [text, setText] = useState("Hello! I am running on Google Colab using a free T4 GPU. No local resources needed.");
  const [selectedVoice, setSelectedVoice] = useState(KOKORO_VOICES[9].id); // Default to Adam
  
  // Audio Settings
  const [speed, setSpeed] = useState(1.0);
  const [pitch, setPitch] = useState(1.0);
  const [selectedStyle, setSelectedStyle] = useState(STYLE_PRESETS[0]);
  const [isCustomStyle, setIsCustomStyle] = useState(false);

  // States
  const [status, setStatus] = useState("idle"); // idle, generating, complete, error
  const [elapsedTime, setElapsedTime] = useState(0);
  const timerRef = useRef(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const [audioBlob, setAudioBlob] = useState(null);
  const [error, setError] = useState(null);
  
  // Progress tracking
  const [progress, setProgress] = useState(0); // 0-100
  const [progressInfo, setProgressInfo] = useState(''); // e.g. "Chunk 3/10"
  
  // Preview State
  const [previewVoiceId, setPreviewVoiceId] = useState(null);
  const [playbackState, setPlaybackState] = useState('stopped');
  const audioRef = useRef(null);
  
  // Web Audio API for pitch control (same as local-tts)
  const audioContextRef = useRef(null);
  const sourceNodeRef = useRef(null);
  const [audioData, setAudioData] = useState(null); // Store raw audio for replay with pitch

  useEffect(() => {
    initMixpanel();
    trackPageView('Cloud TTS');
    
    // Load saved URL from localStorage
    const savedUrl = localStorage.getItem('colabUrl');
    if (savedUrl) {
      setColabUrl(savedUrl);
      checkConnection(savedUrl);
    }
  }, []);

  const checkConnection = async (url) => {
    if (!url) return;
    
    setIsCheckingConnection(true);
    try {
      // Clean URL
      const cleanUrl = url.trim().replace(/\/$/, '');
      
      const response = await fetch(`${cleanUrl}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
        headers: {
          'ngrok-skip-browser-warning': 'true',
          'bypass-tunnel-reminder': 'true',
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        setIsConnected(true);
        setGpuInfo(data.gpu || "Connected");
        localStorage.setItem('colabUrl', cleanUrl);
        setColabUrl(cleanUrl);
      } else {
        setIsConnected(false);
        setGpuInfo("");
      }
    } catch (e) {
      console.error("Connection check failed:", e);
      setIsConnected(false);
      setGpuInfo("");
    }
    setIsCheckingConnection(false);
  };

  const handleGenerate = async () => {
    if (!text || !isConnected) return;
    
    setAudioUrl(null);
    setAudioBlob(null);
    setError(null);
    setStatus("generating");
    setElapsedTime(0);
    setProgress(0);
    setProgressInfo('');
    
    // Start timer
    timerRef.current = setInterval(() => {
      setElapsedTime(prev => prev + 1);
    }, 1000);
    
    const voiceName = KOKORO_VOICES.find(v => v.id === selectedVoice)?.name || selectedVoice;
    trackGenerationStart(text.split(' ').length, text.length, 1, voiceName, selectedStyle.name, text);
    
    try {
      // Use SSE for progress streaming
      const response = await fetch(`${colabUrl}/api/tts`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true',
          'bypass-tunnel-reminder': 'true',
        },
        body: JSON.stringify({
          text,
          voice: selectedVoice,
          speed,
          stream: true, // Enable progress streaming
        }),
      });
      
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `Server error: ${response.status}`);
      }
      
      // Check if response is SSE or regular blob
      const contentType = response.headers.get('content-type') || '';
      console.log('Response content-type:', contentType);
      
      if (contentType.includes('text/event-stream')) {
        // Read SSE stream
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';
          
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));
                
                if (data.type === 'progress') {
                  setProgress(data.percent);
                  setProgressInfo(`Chunk ${data.current}/${data.total}`);
                } else if (data.type === 'complete') {
                  // Decode base64 audio
                  const binaryStr = atob(data.audio);
                  const bytes = new Uint8Array(binaryStr.length);
                  for (let i = 0; i < binaryStr.length; i++) {
                    bytes[i] = binaryStr.charCodeAt(i);
                  }
                  const blob = new Blob([bytes], { type: 'audio/wav' });
                  const url = URL.createObjectURL(blob);
                  const arrayBuffer = bytes.buffer;
                  
                  setAudioBlob(blob);
                  setAudioUrl(url);
                  setAudioData(arrayBuffer);
                  setProgress(100);
                  setStatus("complete");
                  
                  trackGenerationSuccess(text.split(' ').length, text.length, 1, 0, voiceName, selectedStyle.name);
                } else if (data.type === 'error') {
                  throw new Error(data.message);
                }
              } catch (parseErr) {
                console.warn('Failed to parse SSE data:', parseErr);
              }
            }
          }
        }
      } else {
        // Fallback: Regular blob response (old notebook version)
        console.log('Using fallback blob mode (upgrade to kokoro_colab_api_4.ipynb for progress)');
        setProgressInfo('Generating... (no progress with old notebook)');
        
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const arrayBuffer = await blob.arrayBuffer();
        
        setAudioBlob(blob);
        setAudioUrl(url);
        setAudioData(arrayBuffer);
        setProgress(100);
        setStatus("complete");
        
        trackGenerationSuccess(text.split(' ').length, text.length, 1, 0, voiceName, selectedStyle.name);
      }
      
    } catch (e) {
      console.error("Generation failed:", e);
      setError(e.message);
      setStatus("error");
      trackGenerationError(e.message, text.split(' ').length, 1, voiceName);
      
      // Check if connection is still alive
      checkConnection(colabUrl);
    } finally {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  };

  const handlePreview = async (voiceId, e) => {
    e.stopPropagation();
    if (!isConnected) return;
    
    if (audioRef.current) {
      audioRef.current.pause();
    }

    setPreviewVoiceId(voiceId);
    
    const voice = KOKORO_VOICES.find(v => v.id === voiceId);
    trackVoicePreview(voice.name);

    const previewText = `Hello, I am ${voice.name}. I can read any text you type with high fidelity, powered by cloud GPU.`;

    try {
      const response = await fetch(`${colabUrl}/api/tts`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true',
          'bypass-tunnel-reminder': 'true',
        },
        body: JSON.stringify({
          text: previewText,
          voice: voiceId,
          speed,
          // pitch is applied client-side
        }),
      });
      
      if (response.ok) {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        
        if (audioRef.current) {
          audioRef.current.src = url;
          audioRef.current.play();
        }
      }
    } catch (e) {
      console.error("Preview failed:", e);
    }
    
    setPreviewVoiceId(null);
  };

  // Playback with Web Audio API for pitch control
  const playWithPitch = async () => {
    if (!audioData) return;
    
    try {
      // Create audio context if needed
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }
      const ctx = audioContextRef.current;
      
      // Stop any current playback
      if (sourceNodeRef.current) {
        sourceNodeRef.current.stop();
        sourceNodeRef.current.disconnect();
      }
      
      // Decode audio data
      const audioBuffer = await ctx.decodeAudioData(audioData.slice(0));
      
      // Create source
      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      
      // Apply pitch via detune (cents: 1200 cents = 1 octave)
      const pitchInCents = Math.round(1200 * Math.log2(pitch));
      if (source.detune) {
        source.detune.value = pitchInCents;
      }
      
      source.connect(ctx.destination);
      source.onended = () => setPlaybackState('stopped');
      source.start();
      
      sourceNodeRef.current = source;
      setPlaybackState('playing');
    } catch (e) {
      console.error("Playback failed:", e);
      // Fallback to regular audio
      if (audioRef.current && audioUrl) {
        audioRef.current.src = audioUrl;
        audioRef.current.play();
        setPlaybackState('playing');
      }
    }
  };

  const handlePlay = () => {
    if (playbackState === 'playing') {
      // Pause via AudioContext
      if (audioContextRef.current) {
        audioContextRef.current.suspend();
        setPlaybackState('paused');
      }
    } else if (playbackState === 'paused') {
      // Resume
      if (audioContextRef.current) {
        audioContextRef.current.resume();
        setPlaybackState('playing');
      }
    } else {
      // Play from start with pitch
      playWithPitch();
    }
  };

  const handleStop = () => {
    if (sourceNodeRef.current) {
      sourceNodeRef.current.stop();
      sourceNodeRef.current.disconnect();
      sourceNodeRef.current = null;
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setPlaybackState('stopped');
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-white p-6 md:p-12 font-sans">
      <audio 
        ref={audioRef} 
        className="hidden" 
        onEnded={() => setPlaybackState('stopped')}
        onPause={() => { if (audioRef.current?.currentTime > 0) setPlaybackState('paused'); }}
      />
      
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="space-y-4 text-center mb-8">
            <h1 className="text-4xl font-bold bg-linear-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent inline-flex items-center gap-3">
                <Cloud className="w-10 h-10 text-blue-400" />
                Cloud TTS
            </h1>
            <p className="text-gray-400 text-lg">
                Powered by Google Colab GPU. No local resources needed.
            </p>
        </div>

        {/* Connection Panel */}
        <div className={`rounded-2xl p-6 border transition-all ${
          isConnected 
            ? 'bg-emerald-500/10 border-emerald-500/30' 
            : 'bg-neutral-900/50 border-white/5'
        }`}>
          <div className="flex flex-col md:flex-row gap-4 items-start md:items-center">
            <div className="flex-1 w-full">
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 block">
                Colab API URL
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={colabUrl}
                  onChange={(e) => setColabUrl(e.target.value)}
                  placeholder="https://xxxx-xx-xx-xx-xx.ngrok-free.app"
                  className="flex-1 bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50 placeholder:text-gray-600 font-mono text-sm"
                />
                <button
                  onClick={() => checkConnection(colabUrl)}
                  disabled={isCheckingConnection || !colabUrl}
                  className="px-4 py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
                >
                  {isCheckingConnection ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4" />
                  )}
                  Connect
                </button>
              </div>
            </div>
            
            {/* Status */}
            <div className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium ${
              isConnected 
                ? 'bg-emerald-500/20 text-emerald-400' 
                : 'bg-red-500/10 text-red-400'
            }`}>
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
                        ? "bg-blue-600 text-white" 
                        : "text-gray-400 hover:text-white"
                    }`}
                  >
                    Google Colab
                  </button>
                  <button
                    onClick={() => setSetupPlatform("kaggle")}
                    className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                      setupPlatform === "kaggle" 
                        ? "bg-orange-600 text-white" 
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
                  {/* Step 1: Download */}
                  <div className="p-4 bg-blue-500/10 rounded-xl border border-blue-500/20">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0">1</div>
                      <div className="flex-1">
                        <p className="font-medium text-blue-300 mb-2">Download the Colab Notebook</p>
                        <a 
                          href="/kokoro_colab_api_5.ipynb" 
                          download="kokoro_colab_api_5.ipynb"
                          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-white text-sm font-medium transition-colors"
                        >
                          <Download className="w-4 h-4" />
                          Download kokoro_colab_api_5.ipynb
                        </a>
                      </div>
                    </div>
                  </div>

                  {/* Step 2: Get ngrok token */}
                  <div className="p-4 bg-purple-500/10 rounded-xl border border-purple-500/20">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0">2</div>
                      <div className="flex-1">
                        <p className="font-medium text-purple-300 mb-2">Get your free ngrok Auth Token</p>
                        <a 
                          href="https://dashboard.ngrok.com/get-started/your-authtoken" 
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 rounded-lg text-white text-sm font-medium transition-colors"
                        >
                          <ExternalLink className="w-4 h-4" />
                          Get ngrok Token
                        </a>
                      </div>
                    </div>
                  </div>

                  {/* Step 3: Upload and Run */}
                  <div className="p-4 bg-green-500/10 rounded-xl border border-green-500/20">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0">3</div>
                      <div className="flex-1">
                        <p className="font-medium text-green-300 mb-2">Upload to Google Colab & Run</p>
                        <ol className="text-gray-400 text-sm space-y-1 list-decimal list-inside">
                          <li>Go to <a href="https://colab.research.google.com" target="_blank" rel="noopener noreferrer" className="text-green-400 underline">colab.research.google.com</a></li>
                          <li>File → Upload notebook → Select the downloaded file</li>
                          <li>Runtime → Change runtime type → Select <strong className="text-green-300">T4 GPU</strong></li>
                          <li>Paste your ngrok token in Cell 4</li>
                          <li>Run all cells (Ctrl+F9)</li>
                        </ol>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* Kaggle Instructions */}
              {setupPlatform === "kaggle" && (
                <>
                  {/* Step 1: Download */}
                  <div className="p-4 bg-orange-500/10 rounded-xl border border-orange-500/20">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0">1</div>
                      <div className="flex-1">
                        <p className="font-medium text-orange-300 mb-2">Download the Kaggle Notebook</p>
                        <a 
                          href="/kokoro_kaggle_2.ipynb" 
                          download="kokoro_kaggle_2.ipynb"
                          className="inline-flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-500 rounded-lg text-white text-sm font-medium transition-colors"
                        >
                          <Download className="w-4 h-4" />
                          Download kokoro_kaggle_2.ipynb
                        </a>
                      </div>
                    </div>
                  </div>

                  {/* Step 2: Get ngrok token */}
                  <div className="p-4 bg-purple-500/10 rounded-xl border border-purple-500/20">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0">2</div>
                      <div className="flex-1">
                        <p className="font-medium text-purple-300 mb-2">Get your free ngrok Auth Token</p>
                        <a 
                          href="https://dashboard.ngrok.com/get-started/your-authtoken" 
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 rounded-lg text-white text-sm font-medium transition-colors"
                        >
                          <ExternalLink className="w-4 h-4" />
                          Get ngrok Token
                        </a>
                      </div>
                    </div>
                  </div>

                  {/* Step 3: Kaggle Setup */}
                  <div className="p-4 bg-cyan-500/10 rounded-xl border border-cyan-500/20">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 bg-cyan-500 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0">3</div>
                      <div className="flex-1">
                        <p className="font-medium text-cyan-300 mb-2">Upload to Kaggle & Configure</p>
                        <ol className="text-gray-400 text-sm space-y-1 list-decimal list-inside">
                          <li>Go to <a href="https://kaggle.com/notebooks" target="_blank" rel="noopener noreferrer" className="text-cyan-400 underline">kaggle.com</a> → Create → New Notebook</li>
                          <li>File → Import Notebook → Upload the downloaded file</li>
                          <li><strong className="text-yellow-300">⚠️ Verify phone</strong> in Settings for GPU access</li>
                          <li>Right sidebar → Settings → <strong className="text-cyan-300">Internet: ON</strong></li>
                          <li>Right sidebar → Settings → <strong className="text-cyan-300">Accelerator: GPU T4 x2</strong></li>
                          <li>Edit ngrok token in Cell 3, then run cells with Shift+Enter</li>
                        </ol>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* Step 4: Connect - shared */}
              <div className="p-4 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-emerald-500 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0">4</div>
                  <div className="flex-1">
                    <p className="font-medium text-emerald-300 mb-2">Paste the ngrok URL above & Connect!</p>
                    <p className="text-gray-400 text-sm">Copy the URL that looks like <code className="bg-emerald-500/20 px-1.5 py-0.5 rounded text-emerald-300">https://xxxx-xxxx.ngrok-free.app</code> and paste it in the box above, then click Connect.</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className={`bg-neutral-900/50 rounded-3xl p-8 border border-white/5 space-y-8 shadow-2xl transition-opacity ${!isConnected ? 'opacity-50 pointer-events-none' : ''}`}>
            
            {/* 1. Selected Voice Banner */}
            <div className="bg-linear-to-br from-blue-500/10 to-purple-500/10 rounded-2xl p-6 border border-blue-500/20 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                    <Cloud className="w-32 h-32 transform rotate-12 translate-x-8 -translate-y-8" />
                </div>
                <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <div className="text-xs font-semibold text-blue-400 uppercase tracking-widest mb-1">Selected Voice</div>
                        <div className="text-3xl font-bold text-white mb-1">{KOKORO_VOICES.find(v => v.id === selectedVoice)?.name}</div>
                        <div className="flex items-center gap-2 text-sm text-blue-200/60">
                            <span>{KOKORO_VOICES.find(v => v.id === selectedVoice)?.gender}</span>
                            <span>•</span>
                            <span>{KOKORO_VOICES.find(v => v.id === selectedVoice)?.lang}</span>
                        </div>
                    </div>
                    <div className="text-right">
                        <div className="text-xs text-blue-300 mb-1">Style: {selectedStyle.name}</div>
                        <div className="text-blue-400 font-mono text-sm">
                            Speed: {speed}x | Pitch: {pitch > 0 ? '+' : ''}{pitch}
                        </div>
                    </div>
                </div>
            </div>

            {/* 2. Reading Style Grid */}
            <div className="space-y-3">
                <label className="text-sm font-medium text-gray-400 uppercase tracking-wider ml-1">Reading Style</label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {STYLE_PRESETS.map((style) => (
                        <button
                            key={style.id}
                            onClick={() => {
                                setSelectedStyle(style);
                                setIsCustomStyle(false);
                                setSpeed(style.speed);
                                setPitch(style.pitch);
                            }}
                            className={`
                                text-left p-4 rounded-xl border transition-all relative overflow-hidden group
                                ${!isCustomStyle && selectedStyle.id === style.id
                                    ? 'bg-blue-600/20 border-blue-500 ring-1 ring-blue-500/50' 
                                    : 'bg-white/5 border-white/5 hover:bg-white/10 hover:border-white/10 text-gray-400'}
                            `}
                        >
                            <div className="text-2xl mb-2">{style.icon}</div>
                            <div className={`text-sm font-bold leading-tight ${!isCustomStyle && selectedStyle.id === style.id ? 'text-blue-300' : 'text-gray-300'}`}>
                                {style.name}
                            </div>
                            <div className="text-[10px] opacity-60 mt-1 font-medium truncate">
                                {style.description}
                            </div>
                            <div className="text-[9px] mt-2 font-mono opacity-40">
                                {style.speed}x | {style.pitch > 0 ? '+' : ''}{style.pitch}
                            </div>
                        </button>
                    ))}
                     {/* Custom Card */}
                     <button
                        onClick={() => setIsCustomStyle(true)}
                        className={`
                            text-left p-4 rounded-xl border transition-all relative overflow-hidden group
                            ${isCustomStyle
                                ? 'bg-blue-600/20 border-blue-500 ring-1 ring-blue-500/50' 
                                : 'bg-white/5 border-white/5 hover:bg-white/10 hover:border-white/10 text-gray-400'}
                        `}
                    >
                        <div className="text-2xl mb-2">⚙️</div>
                        <div className={`text-sm font-bold leading-tight ${isCustomStyle ? 'text-blue-300' : 'text-gray-300'}`}>
                            Custom
                        </div>
                        <div className="text-[10px] opacity-60 mt-1 font-medium">
                            Set your own
                        </div>
                    </button>
                </div>

                {/* Custom Sliders (Only if Custom) */}
                {isCustomStyle && (
                    <div className="bg-blue-500/5 rounded-xl p-6 border border-blue-500/10 space-y-6 mt-4 animate-in fade-in">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                             {/* Speed */}
                            <div className="space-y-3">
                                <label className="text-sm font-medium text-gray-300 flex justify-between items-center">
                                    <span>Speed</span>
                                    <span className="text-green-400 font-mono bg-green-400/10 px-2 py-0.5 rounded text-xs">{speed.toFixed(2)}x</span>
                                </label>
                                <input 
                                    type="range" min="0.50" max="2.00" step="0.01" 
                                    value={speed} onChange={(e) => setSpeed(parseFloat(e.target.value))}
                                    className="w-full accent-green-500 h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer"
                                />
                            </div>
                            {/* Pitch */}
                            <div className="space-y-3">
                                <label className="text-sm font-medium text-gray-300 flex justify-between items-center">
                                    <span>Pitch</span>
                                    <span className="text-purple-400 font-mono bg-purple-400/10 px-2 py-0.5 rounded text-xs">{pitch.toFixed(2)}x</span>
                                </label>
                                <input 
                                    type="range" min="0.50" max="2.00" step="0.01" 
                                    value={pitch} onChange={(e) => setPitch(parseFloat(e.target.value))}
                                    className="w-full accent-purple-500 h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer"
                                />
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* 3. Voice Selection */}
            <div className="space-y-3">
                <label className="text-sm font-medium text-gray-400 uppercase tracking-wider ml-1">Voice</label>
                
                {/* Voice Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 max-h-[300px] overflow-y-auto custom-scrollbar p-1">
                    {KOKORO_VOICES.map((voice) => (
                        <div 
                            key={voice.id}
                            onClick={() => setSelectedVoice(voice.id)}
                            className={`
                                relative p-3 rounded-xl border transition-all cursor-pointer group flex items-center justify-between
                                ${selectedVoice === voice.id 
                                    ? 'bg-cyan-500/10 border-cyan-500/50 ring-1 ring-cyan-500/20' 
                                    : 'bg-white/5 border-white/5 hover:bg-white/10 hover:border-white/10'}
                            `}
                        >
                            <div className="flex flex-col">
                                <span className={`font-medium text-sm ${selectedVoice === voice.id ? 'text-cyan-300' : 'text-gray-200'}`}>
                                    {voice.name}
                                </span>
                                <span className="text-[10px] text-gray-500 uppercase flex items-center gap-1">
                                    {voice.flag} {voice.gender} • {voice.lang}
                                </span>
                            </div>
                            
                            <button
                                onClick={(e) => handlePreview(voice.id, e)}
                                disabled={!isConnected}
                                className={`
                                    w-8 h-8 rounded-full flex items-center justify-center transition-all
                                    ${previewVoiceId === voice.id 
                                        ? 'bg-cyan-500 text-white' 
                                        : 'bg-white/5 text-gray-400 hover:bg-white/20 hover:text-white disabled:opacity-30'}
                                `}
                            >
                                {previewVoiceId === voice.id ? (
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                    <Play className="w-3 h-3 fill-current" />
                                )}
                            </button>
                        </div>
                    ))}
                </div>
            </div>

            {/* 4. Text Input */}
            <div className="space-y-3">
                <label className="text-sm font-medium text-gray-400 uppercase tracking-wider ml-1">
                    Text <span className="text-xs normal-case text-gray-600 ml-2">{text.length.toLocaleString()} chars</span>
                </label>
                <textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 rounded-xl p-6 text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50 min-h-[200px] resize-y placeholder:text-gray-700 leading-relaxed text-lg"
                    placeholder="Paste your text here..."
                />
            </div>

            {/* Progress (if generating) */}
            {status === 'generating' && (
                <div className="space-y-2 animate-in fade-in bg-black/20 p-4 rounded-xl border border-white/5">
                    <div className="flex justify-between text-xs font-medium text-gray-400">
                        <span className="flex items-center gap-2">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            {progressInfo || 'Starting generation...'}
                        </span>
                        <div className="flex items-center gap-4">
                            <span className="text-green-400 font-mono font-bold">
                                {progress}%
                            </span>
                            <span className="text-cyan-400 font-mono">
                                ⏱ {Math.floor(elapsedTime / 60).toString().padStart(2, '0')}:{(elapsedTime % 60).toString().padStart(2, '0')}
                            </span>
                        </div>
                    </div>
                    <div className="h-3 bg-white/5 rounded-full overflow-hidden">
                        <div 
                            className="h-full bg-linear-to-r from-blue-500 to-purple-500 rounded-full transition-all duration-300"
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                </div>
            )}

            {/* 5. Main Button */}
            <button
                onClick={handleGenerate}
                disabled={status === 'generating' || !text || !isConnected}
                className="w-full bg-linear-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-4 rounded-xl transition-all duration-200 flex items-center justify-center gap-2 shadow-lg shadow-blue-900/20 text-lg transform hover:scale-[1.01] active:scale-[0.99]"
            >
                {status === 'generating' ? (
                    <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Generating on GPU...
                    </>
                ) : (
                    <>
                        ☁️ Generate with "{selectedStyle.name}" style
                    </>
                )}
            </button>
            
            {error && (
                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm text-center">
                    {error}
                </div>
            )}

            {/* Results Player */}
            {audioUrl && (
                <div className="p-6 bg-black/30 rounded-xl border border-white/5 animate-in fade-in slide-in-from-top-2">
                        <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-blue-500/20 rounded-lg text-blue-400">
                            <Play className="w-5 h-5 fill-current" />
                        </div>
                        <div>
                            <div className="text-white font-medium">Generation Complete</div>
                            <div className="text-gray-500 text-xs">Cloud WAV • 24000Hz</div>
                        </div>
                        </div>
                        
                        <div className="flex gap-3">
                        {/* Play/Pause Button */}
                        <button
                            onClick={handlePlay}
                            className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-colors"
                        >
                            {playbackState === 'playing' ? (
                                <><Pause className="w-4 h-4" /> Pause</>
                            ) : playbackState === 'paused' ? (
                                <><Play className="w-4 h-4" /> Resume</>
                            ) : (
                                <><Play className="w-4 h-4" /> Play</>
                            )}
                        </button>
                        
                        {/* Stop Button */}
                        <button
                            onClick={handleStop}
                            disabled={playbackState === 'stopped'}
                            className="py-3 px-4 bg-white/10 hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-colors"
                        >
                            <StopCircle className="w-4 h-4" /> Stop
                        </button>
                        
                        {/* Download Button */}
                        <a 
                            href={audioUrl} 
                            download={`cloud_tts_${selectedVoice}.wav`}
                            onClick={() => trackDownload(KOKORO_VOICES.find(v => v.id === selectedVoice)?.name, "Cloud WAV", text.split(' ').length)}
                            className="flex-1 py-3 bg-white/10 hover:bg-white/20 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-colors"
                        >
                            <Download className="w-4 h-4" /> Download
                        </a>
                        </div>
                </div>
            )}
        </div>

        {/* Informational Content */}
        <div className="bg-neutral-900/50 rounded-3xl p-8 border border-white/5 space-y-8 shadow-2xl">
            <section className="space-y-4">
                <h2 className="text-2xl font-bold bg-linear-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
                    About Cloud TTS
                </h2>
                <div className="prose prose-invert max-w-none text-gray-400">
                    <p>
                        Cloud TTS runs the <strong>Kokoro</strong> neural model on <strong>Google Colab's free T4 GPU</strong>, 
                        keeping your local machine free and responsive. The model is cached in your Google Drive 
                        so it only downloads once.
                    </p>
                </div>
            </section>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                 <div className="p-4 bg-white/5 rounded-xl border border-white/5">
                    <h3 className="text-lg font-semibold text-white mb-2">☁️ Free GPU Power</h3>
                    <p className="text-sm text-gray-400">
                        Uses Colab's T4 GPU (1-2 hours free daily). No local CPU/GPU stress.
                    </p>
                </div>
                 <div className="p-4 bg-white/5 rounded-xl border border-white/5">
                    <h3 className="text-lg font-semibold text-white mb-2">💾 Drive Cached</h3>
                    <p className="text-sm text-gray-400">
                        Model saves to your Google Drive. Subsequent sessions load instantly.
                    </p>
                </div>
                 <div className="p-4 bg-white/5 rounded-xl border border-white/5">
                    <h3 className="text-lg font-semibold text-white mb-2">🎯 Same Quality</h3>
                    <p className="text-sm text-gray-400">
                        Identical voices and quality as Local TTS. All 22 voices supported.
                    </p>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
}
