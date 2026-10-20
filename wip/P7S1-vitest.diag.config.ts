/*
Project: PromptHub
Author: Allan James
Source: wip/P7S1-vitest.diag.config.ts
MIME: text/typescript
Type: TypeScript Vitest config (throwaway)

Created: 20/10/2026 11:43 GMT+10
Last modified: 20/10/2026 14:12 GMT+10
---------------
Vitest config that runs only the P7S1 research diagnostics in wip/. The repository's own vitest.config.ts is untouched.
`esbuild.jsx` is "automatic" because tsconfig.json sets "jsx": "preserve" (Next compiles the JSX itself), which leaves JSX
in the output that Vitest cannot run; P7S1T1 adds the same option to vitest.config.ts.

Changelog:
20/10/2026 14:12 GMT+10 | esbuild.jsx automatic, for the history dialog test
20/10/2026 11:43 GMT+10 | Created for P7S1 research
*/

import { defineConfig } from "vitest/config"
import { fileURLToPath } from "node:url"

const root = fileURLToPath(new URL("..", import.meta.url))

export default defineConfig({
  root,
  esbuild: { jsx: "automatic" },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("../src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["wip/P7S1-*.test.tsx"],
  },
})
