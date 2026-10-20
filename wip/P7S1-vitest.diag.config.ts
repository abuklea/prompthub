/*
Project: PromptHub
Author: Allan James
Source: wip/P7S1-vitest.diag.config.ts
MIME: text/typescript
Type: TypeScript Vitest config (throwaway)

Created: 20/10/2026 11:43 GMT+10
Last modified: 20/10/2026 11:43 GMT+10
---------------
Vitest config that runs only the P7S1 research diagnostics in wip/. The repository's own vitest.config.ts is untouched.

Changelog:
20/10/2026 11:43 GMT+10 | Created for P7S1 research
*/

import { defineConfig } from "vitest/config"
import { fileURLToPath } from "node:url"

const root = fileURLToPath(new URL("..", import.meta.url))

export default defineConfig({
  root,
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
