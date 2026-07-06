/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    // Allow images from any HTTPS/HTTP source — needed for multi-supplier imports
    // where image CDN hostnames are unknown in advance
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
      { protocol: 'http',  hostname: '**' },
    ],
  },
  experimental: {
    // Include the fitment gallery data file in the serverless bundle so the
    // /api/admin/fitment-import route can read it at runtime
    outputFileTracingIncludes: {
      '/api/admin/fitment-import': ['../data/fitmentgallery.csv.gz'],
    },
  },
};

module.exports = nextConfig;
