"use client";

import { useState, useEffect, useRef } from "react";
import { Upload, Play, Download, Loader2, Cpu, Settings, Pause, StopCircle, RefreshCw } from "lucide-react";
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

// Voice Data with Metadata
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
  { id: "default", name: "Default", description: "Normal speed", speed: 1.0, pitch: 0, icon: "🎯" },
  { id: "slow-narrator", name: "Slow Narrator", description: "Audiobook style", speed: 0.8, pitch: -60, icon: "📖" },
  { id: "calm-storyteller", name: "Calm Storyteller", description: "Meditative", speed: 0.7, pitch: -50, icon: "🌙" },
  { id: "dramatic", name: "Dramatic", description: "Theatrical", speed: 0.9, pitch: 50, icon: "🎭" },
  { id: "fast-news", name: "Fast News", description: "News style", speed: 1.2, pitch: 0, icon: "📺" },
  { id: "conversational", name: "Conversational", description: "Casual chat", speed: 1.05, pitch: 50, icon: "💬" },
  { id: "deep-voice", name: "Deep & Powerful", description: "Authoritative", speed: 0.9, pitch: -200, icon: "🎸" },
  { id: "podcast", name: "Podcast Host", description: "Energetic", speed: 1.1, pitch: 50, icon: "🎧" },
];

export default function LocalTTSPage() {
  const [text, setText] = useState("Hello! I am running entirely in your browser using Kokoro JS. No server needed.");
  const [selectedVoice, setSelectedVoice] = useState(KOKORO_VOICES[9].id); // Default to Adam
  
  // Audio Settings
  const [speed, setSpeed] = useState(1.0);
  const [pitch, setPitch] = useState(0); // In cents (-1200 to +1200)
  const [selectedStyle, setSelectedStyle] = useState(STYLE_PRESETS[0]);
  const [isCustomStyle, setIsCustomStyle] = useState(false);

  // States
  const [status, setStatus] = useState("idle"); // idle, loading, generating, complete, error
  const [progressItems, setProgressItems] = useState([]);
  const [generationProgress, setGenerationProgress] = useState({ current: 0, total: 0, text: '' }); // For 50k char progress
  const [audioUrl, setAudioUrl] = useState(null);
  const [audioData, setAudioData] = useState(null); // Store raw audio for replay with FX
  const [error, setError] = useState(null);
  const [modelLoaded, setModelLoaded] = useState(false);
  
  // Preview State
  const [previewVoiceId, setPreviewVoiceId] = useState(null);
  const audioRef = useRef(null);
  
  const worker = useRef(null);

  useEffect(() => {
    initMixpanel();
    trackPageView('Local TTS');
  }, []);

  useEffect(() => {
    if (!worker.current) {
      worker.current = new Worker(new URL("./worker.js", import.meta.url), {
        type: "module",
      });
    }
    
    return () => {
        // cleanup
    };
  }, []); // Run once
  
  // Refs for current settings so the static worker handler can access them
  const settingsRef = useRef({ speed, pitch });
  useEffect(() => { settingsRef.current = { speed, pitch }; }, [speed, pitch]);

  // Audio Context Ref
  const audioContextRef = useRef(null);
  const sourceNodeRef = useRef(null);
  
  // Main Playback Logic
  const playAudio = async (audioData, sampleRate, forcedPitch = null) => {
      // Use forcedPitch if provided (e.g. preview), otherwise use current UI setting
      const pitchToUse = forcedPitch !== null ? forcedPitch : settingsRef.current.pitch;
      
      console.log("Playing with pitch:", pitchToUse);

      if (!audioContextRef.current) {
          audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }
      const ctx = audioContextRef.current;
      
      if (sourceNodeRef.current) {
          sourceNodeRef.current.stop();
          sourceNodeRef.current.disconnect();
      }

      const buffer = ctx.createBuffer(1, audioData.length, sampleRate || 24000);
      buffer.copyToChannel(audioData, 0);

      const source = ctx.createBufferSource();
      source.buffer = buffer;
      
      // Apply Pitch (Detune)
      // detune value is in cents. 100 cents = 1 semitone.
      if (source.detune) {
          source.detune.value = pitchToUse;
      }
      
      source.connect(ctx.destination);
      source.start();
      sourceNodeRef.current = source;
  };

  // Attach worker handler here to verify it works with the function defined in component scope
  useEffect(() => {
      if(!worker.current) return;
      
      worker.current.onmessage = (event) => {
        const { status, file, progress, audio, sampling_rate, error, type, current, total, text: chunkText } = event.data;

         if (status === "init") {
             if (!type) setStatus("loading");
        } else if (status === "progress") {
             if (!type) setStatus("loading");
             setProgressItems((prev) => {
                const existing = prev.find((item) => item.file === file);
                if (existing) {
                    return prev.map((item) => 
                        item.file === file ? { ...item, progress } : item
                    );
                }
                return [...prev, { file, progress }];
            });
        } else if (status === "progress_generation") {
            // New: Handle chunk generation progress
            setStatus("generating");
            setGenerationProgress({ current, total, text: chunkText });
        } else if (status === "generating") {
            if (!type) setStatus("generating");
            setModelLoaded(true);
        } else if (status === "complete") {
            if (type === 'preview') {
                // Previews should match current settings
                playAudio(audio, sampling_rate, null); 
                setPreviewVoiceId(null);
            } else {
                setStatus("complete");
                const wavUrl = createWavUrl(audio, sampling_rate);
                setAudioUrl(wavUrl);
                setAudioData({ audio, sampling_rate }); // Store for replay
                // Play with current user settings
                playAudio(audio, sampling_rate);
                
                // Track Success
                const voiceName = KOKORO_VOICES.find(v => v.id === selectedVoice)?.name || selectedVoice;
                trackGenerationSuccess(text.split(' ').length, text.length, 1, 0, voiceName, selectedStyle.name);
            }
        } else if (status === "error") {
            setError(error);
            setStatus("error");
            setPreviewVoiceId(null);
            
            // Track Error
            const voiceName = KOKORO_VOICES.find(v => v.id === selectedVoice)?.name || selectedVoice;
            trackGenerationError(error, text.split(' ').length, 1, voiceName);
        }
      };
  }, []); // We rely on the refs inside playAudio, so we don't need dependencies here.

  const handleGenerate = () => {
    if (!text) return;
    setAudioUrl(null);
    setError(null);
    if (sourceNodeRef.current) sourceNodeRef.current.stop();
    
    const voiceName = KOKORO_VOICES.find(v => v.id === selectedVoice)?.name || selectedVoice;
    trackGenerationStart(text.split(' ').length, text.length, 1, voiceName, selectedStyle.name, text);
    
    worker.current.postMessage({ 
        text,
        voice: selectedVoice,
        speed // Speed is handled by model during generation
    });
  };

  const handlePreview = (voiceId, e) => {
    e.stopPropagation();
    if (previewVoiceId === voiceId) return; 
    
    if (sourceNodeRef.current) sourceNodeRef.current.stop();

    setPreviewVoiceId(voiceId);
    
    const voice = KOKORO_VOICES.find(v => v.id === voiceId);
    trackVoicePreview(voice.name);

    let previewText = "";
    
    if (voice.lang === "hi") {
        // Simple Hindi greeting
        previewText = `नमस्ते, मेरा नाम ${voice.name} है। मैं आपके लिए पाठ पढ़ सकता हूं।`;
    } else {
        // Longer English preview
        previewText = `Hello, I am ${voice.name}. I can read any text you type with high fidelity and zero latency, running entirely in your browser.`;
    }

    worker.current.postMessage({ 
        text: previewText,
        voice: voiceId,
        speed: speed, // Use current speed
        type: 'preview'
    });
  };
  

  const createWavUrl = (audio, sampleRate) => {
    // Default to 24000Hz (Kokoro standard) if rate is missing or 0
    const rate = sampleRate || 24000;
    
    const buffer = new ArrayBuffer(44 + audio.length * 2);
    const view = new DataView(buffer);
    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + audio.length * 2, true);
    writeString(view, 8, 'WAVE');
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, rate, true);
    view.setUint32(28, rate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeString(view, 36, 'data');
    view.setUint32(40, audio.length * 2, true);
    const length = audio.length;
    let index = 44;
    for (let i = 0; i < length; i++) {
        let s = Math.max(-1, Math.min(1, audio[i]));
        s = s < 0 ? s * 0x8000 : s * 0x7FFF;
        view.setInt16(index, s, true);
        index += 2;
    }
    const blob = new Blob([view], { type: 'audio/wav' });
    return URL.createObjectURL(blob);
  };
    const writeString = (view, offset, string) => {
    for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
    }
    };

  return (
    <div className="min-h-screen bg-neutral-950 text-white p-6 md:p-12 font-sans">
      <audio ref={audioRef} className="hidden" />
      
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="space-y-4 text-center">
            <h1 className="text-4xl font-bold bg-linear-to-r from-green-400 to-blue-500 bg-clip-text text-transparent inline-flex items-center gap-3">
                <Cpu className="w-10 h-10 text-green-400" />
                Local TTS
            </h1>
            <p className="text-gray-400 text-lg">
                High-fidelity neural speech. 100% Private. Unlimited.
            </p>
            {!modelLoaded && (
                <div className="inline-block px-4 py-1.5 rounded-full bg-yellow-500/10 text-yellow-500 text-sm font-medium border border-yellow-500/20">
                    ⚠️ Initial setup requires ~100MB download
                </div>
            )}
        </div>

        <div className="bg-neutral-900/50 rounded-3xl p-8 border border-white/5 space-y-8 shadow-2xl">
            
            {/* 1. Selected Voice Banner */}
            <div className="bg-linear-to-br from-indigo-500/10 to-purple-500/10 rounded-2xl p-6 border border-indigo-500/20 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                    <Cpu className="w-32 h-32 transform rotate-12 translate-x-8 -translate-y-8" />
                </div>
                <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <div className="text-xs font-semibold text-indigo-400 uppercase tracking-widest mb-1">Selected Voice</div>
                        <div className="text-3xl font-bold text-white mb-1">{KOKORO_VOICES.find(v => v.id === selectedVoice)?.name}</div>
                        <div className="flex items-center gap-2 text-sm text-indigo-200/60">
                            <span>{KOKORO_VOICES.find(v => v.id === selectedVoice)?.gender}</span>
                            <span>•</span>
                            <span>{KOKORO_VOICES.find(v => v.id === selectedVoice)?.lang}</span>
                        </div>
                    </div>
                    <div className="text-right">
                        <div className="text-xs text-indigo-300 mb-1">Style: {selectedStyle.name}</div>
                        <div className="text-indigo-400 font-mono text-sm">
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
                                    ? 'bg-indigo-600/20 border-indigo-500 ring-1 ring-indigo-500/50' 
                                    : 'bg-white/5 border-white/5 hover:bg-white/10 hover:border-white/10 text-gray-400'}
                            `}
                        >
                            <div className="text-2xl mb-2">{style.icon}</div>
                            <div className={`text-sm font-bold leading-tight ${!isCustomStyle && selectedStyle.id === style.id ? 'text-indigo-300' : 'text-gray-300'}`}>
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
                                ? 'bg-indigo-600/20 border-indigo-500 ring-1 ring-indigo-500/50' 
                                : 'bg-white/5 border-white/5 hover:bg-white/10 hover:border-white/10 text-gray-400'}
                        `}
                    >
                        <div className="text-2xl mb-2">⚙️</div>
                        <div className={`text-sm font-bold leading-tight ${isCustomStyle ? 'text-indigo-300' : 'text-gray-300'}`}>
                            Custom
                        </div>
                        <div className="text-[10px] opacity-60 mt-1 font-medium">
                            Set your own
                        </div>
                    </button>
                </div>

                {/* Custom Sliders (Only if Custom) */}
                {isCustomStyle && (
                    <div className="bg-indigo-500/5 rounded-xl p-6 border border-indigo-500/10 space-y-6 mt-4 animate-in fade-in">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                             {/* Speed */}
                            <div className="space-y-3">
                                <label className="text-sm font-medium text-gray-300 flex justify-between items-center">
                                    <span>Speed</span>
                                    <span className="text-green-400 font-mono bg-green-400/10 px-2 py-0.5 rounded text-xs">{speed.toFixed(1)}x</span>
                                </label>
                                <input 
                                    type="range" min="0.5" max="2.0" step="0.1" 
                                    value={speed} onChange={(e) => setSpeed(parseFloat(e.target.value))}
                                    className="w-full accent-green-500 h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer"
                                />
                            </div>
                            {/* Pitch */}
                            <div className="space-y-3">
                                <label className="text-sm font-medium text-gray-300 flex justify-between items-center">
                                    <span>Pitch Shift</span>
                                    <span className="text-purple-400 font-mono bg-purple-400/10 px-2 py-0.5 rounded text-xs">{pitch > 0 ? '+' : ''}{pitch}</span>
                                </label>
                                <input 
                                    type="range" min="-600" max="600" step="50" 
                                    value={pitch} onChange={(e) => setPitch(parseInt(e.target.value))}
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
                                    ? 'bg-emerald-500/10 border-emerald-500/50 ring-1 ring-emerald-500/20' 
                                    : 'bg-white/5 border-white/5 hover:bg-white/10 hover:border-white/10'}
                            `}
                        >
                            <div className="flex flex-col">
                                <span className={`font-medium text-sm ${selectedVoice === voice.id ? 'text-emerald-300' : 'text-gray-200'}`}>
                                    {voice.name}
                                </span>
                                <span className="text-[10px] text-gray-500 uppercase flex items-center gap-1">
                                    {voice.flag} {voice.gender} • {voice.lang}
                                </span>
                            </div>
                            
                            <button
                                onClick={(e) => handlePreview(voice.id, e)}
                                className={`
                                    w-8 h-8 rounded-full flex items-center justify-center transition-all
                                    ${previewVoiceId === voice.id 
                                        ? 'bg-emerald-500 text-white' 
                                        : 'bg-white/5 text-gray-400 hover:bg-white/20 hover:text-white'}
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
                    className="w-full bg-black/40 border border-white/10 rounded-xl p-6 text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 min-h-[200px] resize-y placeholder:text-gray-700 leading-relaxed text-lg"
                    placeholder="Paste your text here..."
                />
            </div>

            {/* Progress Bar (if generating) */}
            {(status === 'generating' || status === 'loading') && (
                <div className="space-y-2 animate-in fade-in bg-black/20 p-4 rounded-xl border border-white/5">
                    <div className="flex justify-between text-xs font-medium text-gray-400">
                        <span>
                            {status === 'loading' && "Loading Model..."}
                            {status === 'generating' && `Processing Chunk ${generationProgress.current}/${generationProgress.total}`}
                        </span>
                        <span>
                            {status === 'loading' && progressItems.length > 0 && `${Math.round(progressItems[0].progress)}%`}
                            {status === 'generating' && generationProgress.total > 0 && `${Math.round((generationProgress.current / generationProgress.total) * 100)}%`}
                        </span>
                    </div>
                    <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                        <div 
                            className="h-full bg-linear-to-r from-indigo-500 to-purple-500 transition-all duration-300"
                            style={{ 
                                width: status === 'loading' 
                                    ? `${progressItems.length > 0 ? progressItems[0].progress : 0}%` 
                                    : `${generationProgress.total > 0 ? (generationProgress.current / generationProgress.total) * 100 : 0}%` 
                            }}
                        />
                    </div>
                    {status === 'generating' && (
                        <p className="text-[10px] text-gray-600 truncate font-mono">
                            {generationProgress.text}
                        </p>
                    )}
                </div>
            )}

            {/* 5. Main Button */}
            <button
                onClick={handleGenerate}
                disabled={status === 'loading' || status === 'generating' || !text}
                className="w-full bg-linear-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-4 rounded-xl transition-all duration-200 flex items-center justify-center gap-2 shadow-lg shadow-indigo-900/20 text-lg transform hover:scale-[1.01] active:scale-[0.99]"
            >
                {status === 'loading' ? (
                    <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Initializing...
                    </>
                ) : status === 'generating' ? (
                    <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Generating...
                    </>
                ) : (
                    <>
                        ⚡ Generate with "{selectedStyle.name}" style (50x Fastest)
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
                        <div className="p-2 bg-indigo-500/20 rounded-lg text-indigo-400">
                            <Play className="w-5 h-5 fill-current" />
                        </div>
                        <div>
                            <div className="text-white font-medium">Generation Complete</div>
                            <div className="text-gray-500 text-xs">Local WAV file • {audioData?.sampling_rate}Hz</div>
                        </div>
                        </div>
                        
                        <div className="flex gap-3">
                        <button
                            onClick={() => audioData && playAudio(audioData.audio, audioData.sampling_rate)}
                            className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-colors"
                        >
                            <Play className="w-4 h-4" /> Play (Apply FX)
                        </button>
                        <a 
                            href={audioUrl} 
                            download={`kokoro_${selectedVoice}.wav`}
                            onClick={() => trackDownload(KOKORO_VOICES.find(v => v.id === selectedVoice)?.name, "Local WAV", text.split(' ').length)}
                            className="flex-1 py-3 bg-white/10 hover:bg-white/20 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-colors"
                        >
                            <Download className="w-4 h-4" /> Download WAV
                        </a>
                        </div>
                </div>
            )}
        </div>

        {/* Informational Content */}
        <div className="bg-neutral-900/50 rounded-3xl p-8 border border-white/5 space-y-8 shadow-2xl">
            <section className="space-y-4">
                <h2 className="text-2xl font-bold bg-linear-to-r from-green-400 to-blue-500 bg-clip-text text-transparent">
                    About Local TTS
                </h2>
                <div className="prose prose-invert max-w-none text-gray-400">
                    <p>
                        Our Local TTS tool utilizes the power of <strong>WebAssembly</strong> and the <strong>Kokoro</strong> neural model 
                        to generate speech directly within your web browser. This means that unlike traditional Text-to-Speech services, 
                        your text data is <span className="text-white font-semibold">never sent to a remote server</span>.
                    </p>
                </div>
            </section>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                 <div className="p-4 bg-white/5 rounded-xl border border-white/5">
                    <h3 className="text-lg font-semibold text-white mb-2">🔒 100% Private</h3>
                    <p className="text-sm text-gray-400">
                        Everything runs on your device. Your text never leaves your computer, making it perfect for sensitive or private content.
                    </p>
                </div>
                 <div className="p-4 bg-white/5 rounded-xl border border-white/5">
                    <h3 className="text-lg font-semibold text-white mb-2">⚡ Zero Latency</h3>
                    <p className="text-sm text-gray-400">
                        Once the model is loaded (cached), generation is instant. No network delays or API rate limits.
                    </p>
                </div>
                 <div className="p-4 bg-white/5 rounded-xl border border-white/5">
                    <h3 className="text-lg font-semibold text-white mb-2">💸 Completely Free</h3>
                    <p className="text-sm text-gray-400">
                        No cloud costs means we can offer this toll completely free, forever. Unlimited characters, unlimited downloads.
                    </p>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
}
