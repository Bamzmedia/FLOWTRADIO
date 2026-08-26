import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack: (config) => {
    // Ignore the experimental Coinbase CDP peer dependencies that are dynamically imported but not used
    config.externals = [...(config.externals || []), {
      '@x402/core': 'commonjs @x402/core',
      '@x402/evm': 'commonjs @x402/evm',
      '@x402/svm': 'commonjs @x402/svm',
      '@x402/core/client': 'commonjs @x402/core/client',
      '@x402/evm/exact/client': 'commonjs @x402/evm/exact/client',
      '@x402/evm/upto/client': 'commonjs @x402/evm/upto/client',
      '@x402/svm/exact/client': 'commonjs @x402/svm/exact/client',
    }];
    return config;
  }
};

export default nextConfig;
