/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      { source: "/marketing", destination: "/marketing.html" },
    ];
  },
};

export default nextConfig;
