import MonacoWebpackPlugin from 'monaco-editor-webpack-plugin';

/** @type {import('next').NextConfig} */
const nextConfig = {
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
