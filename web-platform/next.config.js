/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['bullmq'],
  images: {
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'localhost',
      },
    ],
  },
  outputFileTracingRoot: __dirname,
  // Enable standalone output for Docker optimization
  output: 'standalone',
  webpack: (config) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      path: false,
      crypto: false,
    };
    return config;
  },
};

module.exports = nextConfig;