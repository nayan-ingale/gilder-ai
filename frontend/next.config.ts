import path from 'node:path';
import type { NextConfig } from 'next';
import { bucketOrigin, securityHeaders } from './src/server/security-headers';

const nextConfig: NextConfig = {
  // A self-contained server for the Docker image, traced from the repository root so the
  // workspace's packages are included.
  output: 'standalone',
  outputFileTracingRoot: path.resolve(process.cwd(), '..'),
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders({
          dev: process.env.NODE_ENV === 'development',
          // Read when the app is built: the policy is fixed into the build.
          uploadsOrigin: bucketOrigin(process.env.S3_BUCKET_ORIGIN),
        }),
      },
    ];
  },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      '*.css': {
        loaders: ['@tailwindcss/turbopack'],
        as: '*.css',
      },
    },
  },
};

export default nextConfig;
