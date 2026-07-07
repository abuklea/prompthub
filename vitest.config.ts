import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: [
        'src/lib/diff-utils.ts',
        'src/features/prompts/utils.ts',
        'src/features/prompts/schemas.ts',
        'src/features/editor/schemas.ts',
        'src/features/auth/schemas.ts',
      ],
      reporter: ['text', 'html'],
    },
  },
})
