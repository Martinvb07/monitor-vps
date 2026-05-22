/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@xterm/xterm', '@xterm/addon-fit'],
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
