/*
Project: PromptHub
Author: Allan James
Source: vitest.config.ts
MIME: text/typescript
Type: TypeScript Module

Created: 08/07/2026 09:20 GMT+10
Last modified: 29/10/2026 20:03 GMT+10
---------------
Vitest configuration: node environment by default (a DOM test opts in with a `// @vitest-environment jsdom` comment on
its first line), the automatic JSX transform, the server-only alias, and the files held to the coverage target.

Changelog:
29/10/2026 20:03 GMT+10 | Aliased the bare server-only import to the package's empty module; coverage scope of P7S2
                         (P7S2T1)
22/10/2026 08:17 GMT+10 | Added the header; include .test.tsx; automatic JSX transform; coverage scope of P7S1;
                         dropped the absent src/lib/diff-utils.ts
*/
import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  // Reason: tsconfig sets "jsx": "preserve" for Next.js, so a JSX test would fail with "React is not defined".
  esbuild: { jsx: 'automatic' },
  resolve: {
    alias: [
      { find: '@', replacement: fileURLToPath(new URL('./src', import.meta.url)) },
      // Reason: Next resolves server-only to empty.js under its react-server condition; Vitest takes the default
      // export, which throws. Only this import is aliased: a global react-server condition would break the jsdom
      // suites.
      {
        find: /^server-only$/,
        replacement: fileURLToPath(new URL('./node_modules/server-only/empty.js', import.meta.url)),
      },
    ],
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
        'src/lib/action-runner.ts',
        'src/lib/prisma-errors.ts',
        'src/lib/ensure-profile.ts',
        'src/lib/rate-limit.ts',
        'src/features/*/handlers.ts',
        'src/features/prompts/*-handlers.ts',
        'src/features/folders/schemas.ts',
        'src/features/profile/schemas.ts',
        'src/features/auth/client-purge.ts',
        'src/features/workspace/cache.ts',
        'src/test/action-coverage.ts',
      ],
      reporter: ['text', 'html'],
    },
  },
})
