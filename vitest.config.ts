/*
Project: PromptHub
Author: Allan James
Source: vitest.config.ts
MIME: text/typescript
Type: TypeScript Module

Created: 08/07/2026 09:20 GMT+10
Last modified: 22/10/2026 08:17 GMT+10
---------------
Vitest configuration: node environment by default (a DOM test opts in with a `// @vitest-environment jsdom` comment on
its first line), the automatic JSX transform, and the files held to the coverage target.

Changelog:
22/10/2026 08:17 GMT+10 | Added the header; include .test.tsx; automatic JSX transform; coverage scope of P7S1;
                         dropped the absent src/lib/diff-utils.ts
*/
import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  // Reason: tsconfig sets "jsx": "preserve" for Next.js, so a JSX test would fail with "React is not defined".
  esbuild: { jsx: 'automatic' },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      // Reason: a pattern for a file that does not exist yet matches nothing, so later tasks never edit this list.
      include: [
        'src/features/prompts/utils.ts',
        'src/features/prompts/schemas.ts',
        'src/features/editor/schemas.ts',
        'src/features/auth/schemas.ts',
        'src/features/editor/sync.ts',
        'src/features/editor/request-timeout.ts',
        'src/features/editor/draft.ts',
        'src/features/editor/document-cache.ts',
        'src/hooks/use-latest.ts',
        'src/features/editor/loader-state.ts',
        'src/features/editor/loader-protocol.ts',
        'src/features/editor/hooks/useDocumentLoader.ts',
        'src/features/editor/hooks/useAutoSave.ts',
        'src/features/editor/hooks/useDraftSync.ts',
        'src/features/editor/document-actions.ts',
        'src/features/editor/hooks/useDocumentCacheSync.ts',
        'src/features/editor/hooks/useVersionSave.ts',
        'src/features/editor/hooks/useServerAutoSave.ts',
        'src/features/editor/hooks/useVersionRestore.ts',
        'src/features/editor/hooks/useDocumentPersistence.ts',
        'src/features/editor/components/VersionHistoryDialog.tsx',
        'src/features/editor/service.ts',
        'src/test/db.ts',
      ],
      reporter: ['text', 'html'],
    },
  },
})
