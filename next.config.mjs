import withPWA from '@ducanh2912/next-pwa';

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: ['zyszsqgdlrpnunkegipk.supabase.co'],
  },
  experimental: {
    serverActions: true,
  },
  webpack: (config) => {
    config.externals = [...(config.externals || []), 'mssql'];
    
    config.resolve.fallback = {
      ...config.resolve.fallback,
      dgram: false,
      net: false,
      tls: false,
      fs: false,
      url: false,
      crypto: false,
      stream: false,
      constants: false,
      assert: false,
      http: false,
      https: false,
      os: false,
      path: false
    };
    
    return config;
  },
};

export default withPWA({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development'
})(nextConfig);