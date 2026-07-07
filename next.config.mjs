import MonacoWebpackPlugin from 'monaco-editor-webpack-plugin';

const isDev = process.env.NODE_ENV !== 'production';

// Content-Security-Policy.
// Notes:
// - Monaco runs its language services in web workers loaded as blob: URLs → worker-src blob:.
// - Monaco/Tailwind inject styles at runtime → style-src 'unsafe-inline'.
// - Next.js dev (React Refresh) needs 'unsafe-eval'; it is dropped in production.
// - Supabase Auth/REST/Realtime endpoints are allowed via connect-src.
const csp = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "worker-src 'self' blob:",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
  webpack: (config, { isServer }) => {
    // Monaco Editor self-hosting configuration
    // Only apply on client-side (Monaco is browser-only)
    if (!isServer) {
      config.plugins.push(
        new MonacoWebpackPlugin({
          // Specify languages to include (reduces bundle size)
          languages: ['markdown', 'typescript', 'javascript', 'json', 'html', 'css'],
          // Set the public path for Monaco files
          publicPath: '/_next/static/chunks/',
          // Output directory (relative to webpack output)
          filename: '[name].worker.js',
          // Include features (can be customized to reduce bundle size)
          features: [
            'bracketMatching',
            'caretOperations',
            'clipboard',
            'codeAction',
            'codelens',
            'colorPicker',
            'comment',
            'contextmenu',
            'coreCommands',
            'cursorUndo',
            'dnd',
            'documentSymbols',
            'find',
            'folding',
            'fontZoom',
            'format',
            'gotoError',
            'gotoLine',
            'gotoSymbol',
            'hover',
            'inPlaceReplace',
            'iPadShowKeyboard',
            'links',
            'multicursor',
            'parameterHints',
            'quickCommand',
            'quickOutline',
            'referenceSearch',
            'rename',
            'smartSelect',
            'snippets',
            'suggest',
            'toggleHighContrast',
            'toggleTabFocusMode',
            'transpose',
            'unusualLineTerminators',
            'viewportSemanticTokens',
            'wordHighlighter',
            'wordOperations',
            'wordPartOperations'
          ]
        })
      );
    }

    return config;
  }
};

export default nextConfig;
