/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allow large request bodies for TTS with long text
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
};

export default nextConfig;
