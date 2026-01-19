"use client";
import { useEffect } from "react";
import { initMixpanel, trackPageView } from "@/lib/mixpanel";

export default function PrivacyPolicy() {
  useEffect(() => {
    initMixpanel();
    trackPageView('Privacy Policy');
  }, []);

  return (
    <div className="min-h-screen bg-neutral-950 text-white font-sans p-6 md:p-12">
      <div className="max-w-3xl mx-auto space-y-8">
        <h1 className="text-4xl font-bold mb-8">Privacy Policy</h1>
        
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-indigo-400">Introduction</h2>
          <p className="text-gray-300 leading-relaxed">
            At Neural TTS, we prioritize your privacy. This policy outlines how we handle your data when you use our Text-to-Speech services. 
            We are committed to transparency and ensuring your trust.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-indigo-400">Data Collection & Usage</h2>
          <div className="space-y-4 text-gray-300">
            <p><strong className="text-white">Local TTS:</strong> When using our "Local TTS" feature, all processing happens directly in your browser. No voice data or text is sent to our servers.</p>
            <p><strong className="text-white">Cloud TTS:</strong> For our main TTS service, text is processed via secure APIs. We do not store your text or generated audio files permanently. They are processed ephemerally.</p>
            <p><strong className="text-white">Cookies:</strong> We use cookies to remember your preferences (like selected voice and speed) and for analytics to improve our service.</p>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-indigo-400">Third-Party Services</h2>
          <ul className="list-disc pl-5 space-y-2 text-gray-300">
            <li><strong>Google AdSense:</strong> We use Google AdSense to display advertisements. Google may use cookies to serve ads based on your prior visits to our website or other websites.</li>
            <li><strong>Analytics:</strong> We use analytics tools (like Mixpanel) to understand how users interact with our site to improve the experience. All data is anonymized.</li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-indigo-400">Contact Us</h2>
          <p className="text-gray-300">
            If you have any questions about this Privacy Policy, please contact us.
          </p>
        </section>
        
        <div className="mt-12 pt-8 border-t border-white/10">
          <a href="/" className="text-indigo-400 hover:text-indigo-300 transition-colors">← Back to Home</a>
        </div>
      </div>
    </div>
  );
}
