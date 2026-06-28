/** @type {import('next').NextConfig} */
const nextConfig = {
  // Proxy /api requests to the Express backend in dev.
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.API_BASE_URL || 'http://localhost:4000'}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
