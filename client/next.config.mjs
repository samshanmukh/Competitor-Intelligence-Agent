/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    const apiBase = process.env.API_BASE_URL;
    // In production, only proxy /api when an explicit backend URL is provided —
    // never fall back to localhost (that would break the deployed app).
    if (process.env.NODE_ENV === 'production' && !apiBase) return [];
    return [
      {
        source: '/api/:path*',
        destination: `${apiBase || 'http://localhost:4000'}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
