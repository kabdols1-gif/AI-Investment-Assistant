import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  // AI Investment Assistant: Frontend 3010, Backend 8010
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:8010/api/:path*',
      },
    ];
  },
};

export default nextConfig;
