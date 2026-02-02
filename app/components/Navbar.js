"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Coffee } from "lucide-react";

export default function Navbar() {
  const pathname = usePathname();

  const isActive = (path) => pathname === path;

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4 bg-neutral-900/95 backdrop-blur-md border-b border-white/10 shadow-sm transition-all duration-300">
      {/* Left: Logo */}
      <div className="flex items-center">
        <Link 
          href="/" 
          className="text-xl font-bold bg-linear-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent hover:opacity-80 transition-opacity"
        >
          🎙️ NeuralTTS
        </Link>
      </div>

      {/* Center: Navigation Links */}
      <div className="flex items-center gap-6 absolute left-1/2 transform -translate-x-1/2">
        <Link 
          href="/local-tts" 
          className={`text-sm font-medium transition-colors ${
            isActive("/local-tts") 
              ? "text-indigo-400 bg-indigo-500/10 px-3 py-1.5 rounded-full" 
              : "text-gray-400 hover:text-indigo-400"
          }`}
        >
          Local TTS
        </Link>
        <Link 
          href="/cloud-tts" 
          className={`text-sm font-medium transition-colors ${
            isActive("/cloud-tts") 
              ? "text-blue-400 bg-blue-500/10 px-3 py-1.5 rounded-full" 
              : "text-gray-400 hover:text-blue-400"
          }`}
        >
          Cloud TTS
        </Link>
        <Link 
          href="/qwen-tts" 
          className={`text-sm font-medium transition-colors ${
            isActive("/qwen-tts") 
              ? "text-purple-400 bg-purple-500/10 px-3 py-1.5 rounded-full" 
              : "text-gray-400 hover:text-purple-400"
          }`}
        >
          Qwen3 TTS
        </Link>
        <Link 
          href="/xtts" 
          className={`text-sm font-medium transition-colors ${
            isActive("/xtts") 
              ? "text-orange-400 bg-orange-500/10 px-3 py-1.5 rounded-full" 
              : "text-gray-400 hover:text-orange-400"
          }`}
        >
          XTTSv2
        </Link>
        <Link 
          href="/subtitles" 
          className={`text-sm font-medium transition-colors ${
            isActive("/subtitles") 
              ? "text-indigo-400 bg-indigo-500/10 px-3 py-1.5 rounded-full" 
              : "text-gray-400 hover:text-indigo-400"
          }`}
        >
          Subtitles
        </Link>
      </div>

      {/* Right: Buy me a chai */}
      <div className="flex items-center">
        <a 
          href="https://buymeachai.ezee.li/noobdev007" 
          target="_blank" 
          rel="noopener noreferrer"
          className="flex items-center gap-2 px-4 py-2 bg-yellow-400/10 text-yellow-400 border border-yellow-400/20 hover:bg-yellow-400/20 text-xs font-bold rounded-full shadow-md transition-all hover:scale-105 active:scale-95"
          title="Support the developer"
        >
          <Coffee size={14} />
          <span>Buy me a chai</span>
        </a>
      </div>
    </nav>
  );
}
