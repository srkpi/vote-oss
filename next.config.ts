import type { NextConfig } from 'next';

/**
 * Build the list of origins from which the browser is allowed to load images.
 * Includes both http:// and https:// variants of the MinIO endpoint so that
 * `upgrade-insecure-requests` (which silently rewrites http→https on HTTPS
 * pages) doesn't trip CSP when a public URL is built from MINIO_USE_SSL=false.
 * `MINIO_PUBLIC_URL_BASE` takes precedence and is treated as already-final.
 */
function imageOrigins(): string[] {
  const origins = new Set<string>();
  const explicitBase = process.env.MINIO_PUBLIC_URL_BASE?.trim();
  if (explicitBase) {
    try {
      origins.add(new URL(explicitBase).origin);
    } catch {
      /* ignore malformed env */
    }
  }
  const endpoint = process.env.MINIO_ENDPOINT?.trim();
  if (endpoint) {
    const port = (process.env.MINIO_PORT ?? '9000').trim();
    const hostPart = port && port !== '80' && port !== '443' ? `${endpoint}:${port}` : endpoint;
    origins.add(`http://${hostPart}`);
    origins.add(`https://${hostPart}`);
  }
  return [...origins];
}

const IMG_SRC = ["'self'", 'data:', 'blob:', 'https://count.getloli.com', ...imageOrigins()].join(
  ' ',
);

const ContentSecurityPolicy = `
  default-src 'self';
  script-src 'self' 'unsafe-inline' 'unsafe-eval';
  style-src 'self' 'unsafe-inline';
  img-src ${IMG_SRC};
  font-src 'self';
  object-src 'none';
  base-uri 'self';
  form-action 'self';
  frame-ancestors 'none';
  upgrade-insecure-requests;
`
  .replace(/\s{2,}/g, ' ')
  .trim();

const nextConfig: NextConfig = {
  output: 'standalone',
  reactCompiler: true,
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains; preload',
          },
          {
            key: 'Content-Security-Policy',
            value: ContentSecurityPolicy,
          },
          {
            key: 'Permissions-Policy',
            value:
              'camera=(), microphone=(), geolocation=(), payment=(), usb=(), serial=(), bluetooth=(), midi=(), magnetometer=(), gyroscope=(), accelerometer=(), ambient-light-sensor=()',
          },
          {
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
