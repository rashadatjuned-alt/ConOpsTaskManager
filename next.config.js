/** @type {import('next').NextConfig} */
const nextConfig = {
  // Required for Cloudflare OpenNext to find your build assets
  output: 'standalone',
  
  // Ensures compatibility with React 19's stricter hydration
  reactStrictMode: true,
  
  // Optional: If you have remote images from Supabase, add the pattern here
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.supabase.co',
      },
    ],
  },
};

export default nextConfig;
