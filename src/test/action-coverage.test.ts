/*
Project: PromptHub
Author: Allan James
Source: src/test/action-coverage.test.ts
MIME: text/typescript
Type: TypeScript Module

Created: 29/10/2026 21:31 GMT+10
Last modified: 29/10/2026 21:31 GMT+10
---------------
The isolation coverage rule over the real tree: every server action has an isolation test titled
`"<action>: user B ..."` in a `*.isolation.test.ts` file, every wrapper calls its handler, every "use server" file
exports only async functions and types, and src/lib/ensure-profile.ts is server-only. It reads files and never
connects to a database, so it runs without TEST_DATABASE_URL, while the isolation suites it points at are skipped
there. A failure names the action or file; add the isolation test (docs/rules/testing.md#rules) rather than editing
this test.

Changelog:
29/10/2026 21:31 GMT+10 | Created (P7S2T10, issue #118)
*/
import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import { checkActionCoverage, findActions, type SourceFile } from "./action-coverage"

const SRC_DIR = fileURLToPath(new URL("../", import.meta.url))

/** Every .ts and .tsx file under a directory, with its path from the repository root and forward slashes. */
function readTree(dir: string, prefix: string): SourceFile[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = `${prefix}/${entry.name}`
    if (entry.isDirectory()) return readTree(join(dir, entry.name), path)
    if (!/\.tsx?$/.test(entry.name)) return []
    return [{ path, text: readFileSync(join(dir, entry.name), "utf8") }]
  })
}

const files = readTree(SRC_DIR, "src")

describe("isolation coverage of the real tree", () => {
  it("reads the tree it is meant to check", () => {
    const names = findActions(files).map((action) => action.name)
    expect(names.length).toBeGreaterThanOrEqual(25)
    expect(names).toEqual(expect.arrayContaining(["signIn", "signOut", "createFolder", "getDashboardMetrics"]))
    expect(files.some((file) => file.path.endsWith(".isolation.test.ts"))).toBe(true)
  })

  it("has an isolation test for every action", () => {
    expect(checkActionCoverage(files).uncovered).toEqual([])
  })

  it("has every wrapper call its handler with the real dependencies", () => {
    expect(checkActionCoverage(files).notDelegating).toEqual([])
  })

  it("exports only async functions and types from a use server file", () => {
    expect(checkActionCoverage(files).badExports).toEqual([])
  })

  it("keeps ensure-profile server-only and without the use server directive", () => {
    expect(checkActionCoverage(files).ensureProfile).toEqual([])
  })
})
