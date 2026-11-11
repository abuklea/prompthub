/*
Project: PromptHub
Author: Allan James
Source: src/lib/server-only-alias.test.ts
MIME: text/typescript
Type: TypeScript Module

Created: 29/10/2026 20:03 GMT+10
Last modified: 29/10/2026 20:05 GMT+10
---------------
Tests that the bare `server-only` import resolves to the package's empty module under Vitest. Without the alias in
vitest.config.ts the package's default export throws, and every suite that imports a server-only module would fail.

Changelog:
29/10/2026 20:03 GMT+10 | Created (P7S2T1)
*/
import { expect, it } from "vitest"

it("imports server-only under Vitest without throwing", async () => {
  // @ts-expect-error -- Reason: server-only ships no type declarations; only this value import needs one.
  await expect(import("server-only")).resolves.toBeDefined()
})
