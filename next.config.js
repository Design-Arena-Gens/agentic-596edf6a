/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "s4.anilist.co"
      },
      {
        protocol: "https",
        hostname: "s3.anilist.co"
      },
      {
        protocol: "https",
        hostname: "s2.anilist.co"
      }
    ]
  }
};

module.exports = nextConfig;
