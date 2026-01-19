const nextConfig = {
  serverExternalPackages: ['bufferutil', 'utf-8-validate', 'edge-tts-universal'],
  // Allow large request bodies for TTS with long text
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },

};

export default nextConfig;
