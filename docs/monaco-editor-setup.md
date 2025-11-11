# PromptHub
## Monaco Editor Self-Hosting Setup

| `Title` | `Created` | `Last modified` |
|---------|-----------|-----------------|
| Monaco Editor Self-Hosting Setup | 09/11/2025 18:30 GMT+10 | 09/11/2025 18:30 GMT+10 |

## Table of Contents
- [Overview](#overview)
- [Why Self-Host Monaco](#why-self-host-monaco)
- [Implementation Details](#implementation-details)
- [File Structure](#file-structure)
- [Configuration](#configuration)
- [Troubleshooting](#troubleshooting)

## Overview

This project uses Monaco Editor (the code editor that powers VS Code) for editing prompts. Monaco is configured to load from self-hosted files instead of a CDN to avoid browser tracking prevention issues.

## Why Self-Host Monaco

### Problem
When loading Monaco from a CDN (`cdn.jsdelivr.net`), browsers with tracking prevention (Safari, Brave, Edge) block storage access, causing console warnings:

```
Tracking Prevention blocked access to storage for <URL>.
```

### Solution
Self-host Monaco Editor files from the `/public/monaco-editor/` directory, served from your own domain.

### Benefits
- ✅ No tracking prevention warnings
- ✅ Better performance (no external dependencies)
- ✅ Offline support
- ✅ Full control over Monaco version
- ✅ Improved security (no third-party scripts)
- ✅ Faster initial load (local files)

## Implementation Details

### Packages Used

1. **monaco-editor** (v0.54.0) - Core Monaco Editor package
2. **@monaco-editor/react** (v4.6.0) - React wrapper for Monaco
3. **monaco-editor-webpack-plugin** (v7.1.1) - Webpack integration

### How It Works

1. **Postinstall Hook**: After `npm install`, Monaco files are automatically copied from `node_modules/monaco-editor/min/vs` to `public/monaco-editor/vs`

2. **Loader Configuration**: The `@monaco-editor/react` loader is configured to use `/monaco-editor/vs` instead of CDN

3. **Dynamic Import**: Monaco is loaded via Next.js dynamic import with SSR disabled (Monaco requires browser environment)

## File Structure

```
PromptHub/
├── public/
│   └── monaco-editor/        # Self-hosted Monaco files (git-ignored)
│       └── vs/
│           ├── loader.js
│           ├── editor/
│           │   ├── editor.main.js
│           │   └── editor.main.css
│           ├── basic-languages/
│           ├── language/
│           └── workers/
├── scripts/
│   └── copy-monaco.js        # Postinstall script
├── src/
│   └── features/
│       └── editor/
│           └── components/
│               └── Editor.tsx # Monaco wrapper component
└── next.config.mjs           # Webpack plugin configuration
```

## Configuration

### 1. Editor Component (`src/features/editor/components/Editor.tsx`)

```typescript
const MonacoEditor = dynamic(
  () => import('@monaco-editor/react').then((mod) => {
    // Configure to use self-hosted Monaco
    mod.loader.config({
      paths: {
        vs: '/monaco-editor/vs'
      }
    })
    return mod
  }),
  { ssr: false }
)
```

### 2. Next.js Config (`next.config.mjs`)

```javascript
import MonacoWebpackPlugin from 'monaco-editor-webpack-plugin';

const nextConfig = {
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.plugins.push(
        new MonacoWebpackPlugin({
          languages: ['markdown', 'typescript', 'javascript', 'json', 'html', 'css'],
          publicPath: '/_next/static/chunks/',
          filename: '[name].worker.js'
        })
      );
    }
    return config;
  }
};
```

### 3. Package Scripts (`package.json`)

```json
{
  "scripts": {
    "postinstall": "node scripts/copy-monaco.js"
  }
}
```

### 4. Copy Script (`scripts/copy-monaco.js`)

Automatically copies Monaco files from `node_modules` to `public` directory after installation.

## Troubleshooting

### Monaco Files Missing

If Monaco files are not in `public/monaco-editor/`, run:

```bash
npm run postinstall
# or
node scripts/copy-monaco.js
```

### Still Seeing CDN Warnings

1. **Clear browser cache** - Old Monaco loader may be cached
2. **Restart dev server** - Ensure new configuration is loaded
3. **Check browser DevTools Network tab** - Verify requests are going to `/monaco-editor/vs/` not `cdn.jsdelivr.net`

### Build Errors

If you see webpack errors related to Monaco:

1. Ensure all packages are installed: `npm install`
2. Clean build: `rm -rf .next && npm run build`
3. Verify `monaco-editor-webpack-plugin` is in `devDependencies`

### Editor Not Loading

Check browser console for errors. Common issues:

- **404 errors for `/monaco-editor/vs/*`**: Run `npm run postinstall`
- **Dynamic import errors**: Ensure `ssr: false` in dynamic import
- **Worker errors**: Check `publicPath` in webpack config

## Maintenance

### Updating Monaco Version

1. Update package version: `npm install monaco-editor@latest`
2. Copy new files: `npm run postinstall`
3. Test thoroughly in development
4. Check for breaking changes in Monaco changelog

### Reducing Bundle Size

Edit `next.config.mjs` to include only needed languages:

```javascript
languages: ['markdown', 'typescript'], // Remove unused languages
```

Or reduce features:

```javascript
features: [
  'find',
  'clipboard',
  'contextmenu',
  // Remove unused features
]
```

## References

- [Monaco Editor Documentation](https://microsoft.github.io/monaco-editor/)
- [@monaco-editor/react Documentation](https://github.com/suren-atoyan/monaco-react)
- [Next.js Dynamic Imports](https://nextjs.org/docs/advanced-features/dynamic-import)
