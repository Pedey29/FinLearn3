import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  webpack: (config, { isServer }) => {
    // Exclude Supabase functions from being processed by webpack
    config.externals = [...(config.externals || []), { 'supabase/functions': 'supabase/functions' }];
    
    return config;
  }
};

export default nextConfig;
