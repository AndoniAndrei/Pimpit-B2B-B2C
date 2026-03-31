/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.googleusercontent.com' },
      { protocol: 'https', hostname: 'api.statusfalgar.se' },
      { protocol: 'https', hostname: 'www.abswheels.eu' },
      { protocol: 'https', hostname: 'veemann.com' },
      { protocol: 'https', hostname: '*.wheeltrade.eu' },
      { protocol: 'https', hostname: 'felgeo.pl' },
      { protocol: 'http', hostname: 'felgeo.pl' }
    ],
  },
};

module.exports = nextConfig;
