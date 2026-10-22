/*
Project: PromptHub
Author: Allan James
Source: src/features/editor/sync.test.ts
MIME: text/typescript
Type: TypeScript test (Vitest, node)

Created: 22/10/2026 08:16 GMT+10
Last modified: 22/10/2026 08:19 GMT+10
---------------
Unit tests of the sync helpers: field equality, the autosave decision, the editor view and the footer's save status.

Changelog:
22/10/2026 08:19 GMT+10 | The expected value is the second column of each table, so the test titles name it
22/10/2026 08:16 GMT+10 | Created from the sync block of the P7S1 draft spike suite (P7S1T4)
*/

import { describe, expect, it } from "vitest"
import { needsAutoSave, sameFields, saveStatus, viewState, type DocFields, type SyncedState } from "./sync"

const A = "11111111-1111-4111-8111-111111111111"
const B = "22222222-2222-4222-8222-222222222222"
const synced: SyncedState = { promptId: A, title: "T", content: "c" }

describe("sameFields", () => {
  it("treats a null title and an empty title as the same", () => {
    expect(sameFields({ title: null, content: "c" }, { title: "", content: "c" })).toBe(true)
    expect(sameFields({ title: "", content: "c" }, { title: null, content: "c" })).toBe(true)
  })

  it("tells a different title or a different content apart", () => {
    expect(sameFields({ title: "T", content: "c" }, { title: "U", content: "c" })).toBe(false)
    expect(sameFields({ title: "T", content: "c" }, { title: "T", content: "d" })).toBe(false)
    expect(sameFields({ title: "T", content: "c" }, { title: "T", content: "c" })).toBe(true)
  })
})

describe("needsAutoSave", () => {
  it.each<[string, boolean, string, DocFields, SyncedState | null]>([
    ["no baseline", false, A, { title: "T", content: "d" }, null],
    ["equal fields", false, A, { title: "T", content: "c" }, synced],
    ["changed content", true, A, { title: "T", content: "d" }, synced],
    ["changed title", true, A, { title: "U", content: "c" }, synced],
    ["a null title", false, A, { title: null, content: "d" }, synced],
    ["an empty title", false, A, { title: "", content: "d" }, synced],
    ["a whitespace title", false, A, { title: "   ", content: "d" }, synced],
    ["a baseline for another document", false, B, { title: "T", content: "d" }, synced],
  ])("with %s is %s", (_name, expected, promptId, working, baseline) => {
    expect(needsAutoSave(promptId, working, baseline)).toBe(expected)
  })
})

describe("viewState", () => {
  it.each<[string, string, { promptId: string; error: string; loading: boolean; ready: boolean }]>([
    ["no document", "empty", { promptId: "", error: "", loading: false, ready: false }],
    ["no document, even with a stale error", "empty", { promptId: "", error: "x", loading: false, ready: false }],
    [
      "a failed load, which is neither loading nor ready",
      "error",
      { promptId: A, error: "x", loading: false, ready: false },
    ],
    ["an error while loading", "error", { promptId: A, error: "x", loading: true, ready: false }],
    ["loading", "loading", { promptId: A, error: "", loading: true, ready: false }],
    ["loading while still ready", "loading", { promptId: A, error: "", loading: true, ready: true }],
    [
      "not loading but not ready: the render where the document just changed",
      "loading",
      { promptId: A, error: "", loading: false, ready: false },
    ],
    ["ready", "editor", { promptId: A, error: "", loading: false, ready: true }],
  ])("for %s is %s", (_name, expected, state) => {
    expect(viewState(state)).toBe(expected)
  })
})

describe("saveStatus", () => {
  it.each<[string, string, boolean, DocFields, SyncedState | null]>([
    ["autosaving", "saving", true, { title: "T", content: "d" }, synced],
    ["autosaving with no baseline", "saving", true, { title: "T", content: "c" }, null],
    ["no baseline", "unsaved", false, { title: "T", content: "c" }, null],
    ["equal to the baseline", "saved", false, { title: "T", content: "c" }, synced],
    ["a null title over an empty one", "saved", false, { title: null, content: "c" }, { ...synced, title: "" }],
    ["a draft applied over the baseline", "unsaved", false, { title: "T", content: "d" }, synced],
    ["a title typed over a null title", "unsaved", false, { title: "T", content: "c" }, { ...synced, title: null }],
  ])("while %s is %s", (_name, expected, autoSaving, working, baseline) => {
    expect(saveStatus({ autoSaving, working, synced: baseline })).toBe(expected)
  })
})
