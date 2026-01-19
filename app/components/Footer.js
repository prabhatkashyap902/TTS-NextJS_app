"use client";

import { trackClick, trackSupportClick } from "@/lib/mixpanel";

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="w-full bg-neutral-900 border-t border-white/5 py-12 mt-20">
      <div className="max-w-6xl mx-auto px-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
          {/* Brand */}
          <div className="space-y-4">
            <h3 className="text-xl font-bold bg-linear-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
              🎙️ Neural TTS
            </h3>
            <p className="text-gray-400 text-sm leading-relaxed">
              Premium AI voice generation, running entirely in your browser or via cloud APIs. Secure, fast, and free forever.
            </p>
          </div>

          {/* Product */}
          <div className="space-y-4">
            <h4 className="font-semibold text-white">Product</h4>
            <ul className="space-y-2 text-sm text-gray-400">
              <li><a href="/" onClick={() => trackClick('Footer: Cloud TTS')} className="hover:text-indigo-400 transition-colors">Cloud TTS</a></li>
              <li><a href="/local-tts" onClick={() => trackClick('Footer: Local TTS')} className="hover:text-indigo-400 transition-colors">Local TTS (Offline)</a></li>
              <li><a href="/subtitles" onClick={() => trackClick('Footer: Subtitles')} className="hover:text-indigo-400 transition-colors">Subtitle Generator</a></li>
            </ul>
          </div>

          {/* Legal */}
          <div className="space-y-4">
            <h4 className="font-semibold text-white">Legal</h4>
            <ul className="space-y-2 text-sm text-gray-400">
              <li><a href="/privacy-policy" onClick={() => trackClick('Footer: Privacy Policy')} className="hover:text-indigo-400 transition-colors">Privacy Policy</a></li>
              <li><a href="/terms" onClick={() => trackClick('Footer: Terms')} className="hover:text-indigo-400 transition-colors">Terms of Service</a></li>
            </ul>
          </div>

          {/* Contact */}
          <div className="space-y-4">
            <h4 className="font-semibold text-white">Connect</h4>
             <a 
                href="https://buymeachai.ezee.li/noobdev007" 
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => trackSupportClick()}
                className="inline-flex items-center gap-2 px-4 py-2 bg-yellow-400/10 text-yellow-400 rounded-lg border border-yellow-400/20 hover:bg-yellow-400/20 transition-all text-sm font-medium"
              >
                <span>☕</span> Buy me a chai
              </a>
          </div>
        </div>

        <div className="pt-8 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-gray-500 text-sm">
            © {currentYear} Neural TTS. All rights reserved.
          </p>
          <p className="text-gray-600 text-xs">
            Not affiliated with any major tech companies. Voices provided by respective APIs.
          </p>
        </div>
      </div>
    </footer>
  );
}
