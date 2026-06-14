import withSerwistInit from '@serwist/next';
import withBundleAnalyzer from '@next/bundle-analyzer';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const isDev = process.env['NODE_ENV'] === 'development';
const appPlatform = process.env['NEXT_PUBLIC_APP_PLATFORM'];

if (isDev) {
  const { initOpenNextCloudflareForDev } = await import('@opennextjs/cloudflare');
  initOpenNextCloudflareForDev();
}

const exportOutput = appPlatform !== 'web' && !isDev;

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Ensure Next.js uses SSG instead of SSR
  // https://nextjs.org/docs/pages/building-your-application/deploying/static-exports
  output: exportOutput ? 'export' : undefined,
  pageExtensions: exportOutput ? ['jsx', 'tsx'] : ['js', 'jsx', 'ts', 'tsx'],
  // Note: This feature is required to use the Next.js Image component in SSG mode.
  // See https://nextjs.org/docs/messages/export-image-api for different workarounds.
  images: {
    unoptimized: true,
  },
  devIndicators: false,
  experimental: {
    // Persist Turbopack's compilation cache to `.next/` so CI can restore it
    // between runs. Dev caching is on by default since Next 16.1; build
    // caching is opt-in (beta).
    turbopackFileSystemCacheForDev: true,
    turbopackFileSystemCacheForBuild: true,
  },
  // Configure assetPrefix or else the server won't properly resolve your assets.
  assetPrefix: '',
  reactStrictMode: true,
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  serverExternalPackages: ['isows', 'better-sqlite3', 'bcryptjs', 'jsonwebtoken', 'nodemailer', 'imapflow', 'mailparser'],
  allowedDevOrigins: ['192.168.2.120'],
  webpack: (config, { isServer }) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      nunjucks: 'nunjucks/browser/nunjucks.js',
      fflate: path.resolve(__dirname, 'node_modules/fflate'),
      // WRead: On the client, redirect server-only modules to empty stubs.
      // We must match both @/utils/* and the relative import paths used within
      // the wread-* modules themselves. Using absolute paths ensures webpack
      // can resolve the alias regardless of how the import is written.
      ...(!isServer
        ? {
            'better-sqlite3': false,
            [path.resolve(__dirname, 'src/utils/wread-db')]: path.resolve(__dirname, 'src/utils/wread-db-stub.ts'),
            [path.resolve(__dirname, 'src/utils/wread-db/index')]: path.resolve(__dirname, 'src/utils/wread-db-stub.ts'),
            [path.resolve(__dirname, 'src/utils/wread-auth')]: path.resolve(__dirname, 'src/utils/wread-auth-stub.ts'),
            [path.resolve(__dirname, 'src/utils/wread-init')]: path.resolve(__dirname, 'src/utils/wread-init-stub.ts'),
            [path.resolve(__dirname, 'src/utils/wread-email')]: path.resolve(__dirname, 'src/utils/wread-email-stub.ts'),
          }
        : {}),
      ...(appPlatform !== 'web' ? { '@tursodatabase/database-wasm': false } : {}),
    };
    return config;
  },
  turbopack: {
    resolveAlias: {
      nunjucks: 'nunjucks/browser/nunjucks.js',
      // Turbopack rejects absolute paths in resolveAlias ("server relative
      // imports not implemented") — use a project-relative path.
      fflate: './node_modules/fflate',
      // WRead: better-sqlite3 is handled via serverExternalPackages + conditional
      // import in wread-db. DO NOT alias it here for the same reason as webpack.
      ...(appPlatform !== 'web' ? { '@tursodatabase/database-wasm': './src/utils/stub.ts' } : {}),
    },
  },
  transpilePackages: [
    'ai',
    'ai-sdk-ollama',
    '@ai-sdk/react',
    '@assistant-ui/react',
    '@assistant-ui/react-ai-sdk',
    '@assistant-ui/react-markdown',
    'streamdown',
    ...(isDev
      ? []
      : [
          'i18next-browser-languagedetector',
          'react-i18next',
          'i18next',
          '@tauri-apps',
          'highlight.js',
          'foliate-js',
          'marked',
        ]),
  ],
  async rewrites() {
    return [
      {
        source: '/reader/:ids',
        destination: '/reader?ids=:ids',
      },
      {
        source: '/o/book/:hash/annotation/:id',
        destination: '/o?book=:hash&note=:id',
      },
      {
        source: '/s/:token',
        destination: '/s?token=:token',
      },
    ];
  },
  async headers() {
    return [
      {
        source: '/.well-known/apple-app-site-association',
        headers: [
          {
            key: 'Content-Type',
            value: 'application/json',
          },
        ],
      },
      {
        source: '/_next/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: isDev
              ? 'public, max-age=0, must-revalidate'
              : 'public, max-age=31536000, immutable',
          },
        ],
      },
    ];
  },
};

const pwaDisabled = isDev || appPlatform !== 'web';

const withPWA = pwaDisabled
  ? (config) => config
  : withSerwistInit({
      swSrc: 'src/sw.ts',
      swDest: 'public/sw.js',
      cacheOnNavigation: true,
      reloadOnOnline: true,
      disable: false,
      register: true,
      scope: '/',
    });

const withAnalyzer = withBundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
});

export default withPWA(withAnalyzer(nextConfig));
