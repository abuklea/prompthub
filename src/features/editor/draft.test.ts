/*
Project: PromptHub
Author: Allan James
Source: src/features/editor/draft.test.ts
MIME: text/typescript
Type: TypeScript test (Vitest, node)

Created: 22/10/2026 08:16 GMT+10
Last modified: 22/10/2026 08:16 GMT+10
---------------
Unit tests of the draft store: the content hash, the strict v1 envelope, reading (v1 first, then the legacy value),
the load decision, writing, compare-and-delete, the conflict stash, discarding a consumed draft, and the browser
storage lookup. Storage is injected through the DraftStorage seam with the fakes of src/test/storage-fake.ts.

Changelog:
22/10/2026 08:16 GMT+10 | Created from the pure-helper blocks of the P7S1 draft spike suite (P7S1T4)
*/

import { afterEach, describe, expect, it, vi } from "vitest"
import { makeBrokenStorage, makeStorage } from "@/test/storage-fake"
import {
  clearDraft,
  conflictKey,
  discardRead,
  draftKey,
  getBrowserStorage,
  hashContent,
  legacyDraftKey,
  parseDraft,
  readDraft,
  readRaw,
  removeIfUnchanged,
  resolveDraft,
  stashConflict,
  writeDraft,
  type ReadDraft,
} from "./draft"

const A = "11111111-1111-4111-8111-111111111111"
const B = "22222222-2222-4222-8222-222222222222"
const v1 = (base: string, content: string) => JSON.stringify({ v: 1, base, content })

describe("draft keys", () => {
  it("names the v1 envelope, the legacy value and the conflict stash, all under the prompt- prefix", () => {
    expect(draftKey(A)).toBe(`prompt-v1-${A}`)
    expect(legacyDraftKey(A)).toBe(`prompt-${A}`)
    expect(conflictKey(A)).toBe(`prompt-v1-${A}:conflict`)
  })
})

describe("hashContent", () => {
  it("is deterministic and starts with the length", () => {
    expect(hashContent("hello")).toBe(hashContent("hello"))
    expect(hashContent("hello").startsWith("5:")).toBe(true)
    expect(hashContent("").startsWith("0:")).toBe(true)
  })

  it("is cyrb53 with seed 0, in base 36, after the length", () => {
    // Reason: every stored draft carries this hash as its base, so a changed algorithm would turn each into a conflict.
    expect(hashContent("a")).toBe(`1:${(7929297801672961).toString(36)}`)
    expect(hashContent("revenge")).toBe(`7:${(4051478007546757).toString(36)}`)
    expect(hashContent("revenue")).toBe(`7:${(8309097637345594).toString(36)}`)
  })

  it("differs for one changed character and for a different length", () => {
    expect(hashContent("hello")).not.toBe(hashContent("hellp"))
    expect(hashContent("hello")).not.toBe(hashContent("hello "))
  })

  it("has no collision across 10,000 distinct strings built from the loop index", () => {
    const seen = new Set<string>()
    for (let i = 0; i < 10_000; i++) seen.add(hashContent(`prompt number ${i} ${"x".repeat(i % 50)}`))
    expect(seen.size).toBe(10_000)
  })
})

describe("parseDraft", () => {
  it("reads a v1 envelope, including an empty content", () => {
    expect(parseDraft(v1("5:abc", "text"))).toEqual({ content: "text", base: "5:abc" })
    expect(parseDraft(v1("0:0", ""))).toEqual({ content: "", base: "0:0" })
  })

  it.each<[string, string | null]>([
    ["null", null],
    ["an empty string", ""],
    ["a plain string", "just some text"],
    ["another version", JSON.stringify({ v: 2, base: "x", content: "c" })],
    ["a version given as a string", JSON.stringify({ v: "1", base: "x", content: "c" })],
    ["an empty base", JSON.stringify({ v: 1, base: "", content: "c" })],
    ["a missing base", JSON.stringify({ v: 1, content: "c" })],
    ["a non-string content", JSON.stringify({ v: 1, base: "x", content: 5 })],
    ["malformed JSON", '{"v":1,"base":"x"'],
    ["valid JSON that is not a draft", '{"foo":1}'],
    ["a JSON array", "[1,2]"],
    ["a JSON string", '"quoted"'],
    ["JSON null", "null"],
  ])("returns null for %s: only a v1 envelope is a draft", (_name, raw) => {
    expect(parseDraft(raw)).toBeNull()
  })
})

describe("readDraft", () => {
  it("reads the v1 envelope from its own key", () => {
    const storage = makeStorage({ [draftKey(A)]: v1("5:abc", "text") })
    expect(readDraft(storage, A)).toEqual({
      draft: { content: "text", base: "5:abc" },
      raw: v1("5:abc", "text"),
      legacy: false,
    })
  })

  it("reads a v1 envelope with an empty content: an empty document is a valid draft", () => {
    const storage = makeStorage({ [draftKey(A)]: v1("4:abc", "") })
    expect(readDraft(storage, A)?.draft).toEqual({ content: "", base: "4:abc" })
  })

  it("falls back to the raw text of the removed hook, which has no base", () => {
    const storage = makeStorage({ [legacyDraftKey(A)]: "old text" })
    expect(readDraft(storage, A)).toEqual({ draft: { content: "old text", base: null }, raw: "old text", legacy: true })
  })

  it("prefers the v1 envelope when both keys exist", () => {
    const storage = makeStorage({ [draftKey(A)]: v1("5:abc", "new"), [legacyDraftKey(A)]: "old" })
    expect(readDraft(storage, A)).toMatchObject({ draft: { content: "new" }, legacy: false })
  })

  it("reads no draft from an empty legacy value or from an unreadable v1 value", () => {
    expect(readDraft(makeStorage({ [legacyDraftKey(A)]: "" }), A)).toBeNull()
    expect(readDraft(makeStorage({ [draftKey(A)]: JSON.stringify({ v: 2, base: "x", content: "c" }) }), A)).toBeNull()
    expect(readDraft(makeStorage(), A)).toBeNull()
  })

  it("ignores an unreadable v1 value and leaves it in place", () => {
    const unknown = JSON.stringify({ v: 2, base: "x", content: "c" })
    const storage = makeStorage({ [draftKey(A)]: unknown, [legacyDraftKey(A)]: "old" })
    expect(readDraft(storage, A)).toEqual({ draft: { content: "old", base: null }, raw: "old", legacy: true })
    expect(storage.getItem(draftKey(A))).toBe(unknown)
  })

  it("treats text that looks like a v1 envelope under the legacy key as text", () => {
    const lookalike = v1("5:abc", "inner")
    const storage = makeStorage({ [legacyDraftKey(A)]: lookalike })
    expect(readDraft(storage, A)).toEqual({ draft: { content: lookalike, base: null }, raw: lookalike, legacy: true })
  })

  it("reads another document's draft as no draft", () => {
    expect(readDraft(makeStorage({ [draftKey(B)]: v1("1:a", "x"), [legacyDraftKey(B)]: "y" }), A)).toBeNull()
  })

  it("never throws: a null storage and a blocked storage read as no draft", () => {
    expect(readDraft(null, A)).toBeNull()
    expect(readDraft(makeBrokenStorage(), A)).toBeNull()
    expect(readRaw(null, "k")).toBeNull()
    expect(readRaw(makeBrokenStorage(), "k")).toBeNull()
    expect(readRaw(makeStorage({ k: "v" }), "k")).toBe("v")
  })
})

describe("resolveDraft", () => {
  const text = "server text"
  const blankTitles = [null, "", "  "]

  it("returns none without a draft and when the draft equals the server content", () => {
    const base = hashContent(text)
    for (const title of ["Title", ...blankTitles]) {
      const server = { title, content: text }
      expect(resolveDraft(server, null)).toEqual({ kind: "none" })
      expect(resolveDraft(server, { content: text, base })).toEqual({ kind: "none" })
      expect(resolveDraft(server, { content: text, base: null })).toEqual({ kind: "none" })
      expect(resolveDraft(server, { content: text, base: "9:other" })).toEqual({ kind: "none" })
    }
  })

  it("applies a legacy draft only to a document that was never saved (blank title)", () => {
    for (const title of blankTitles) {
      expect(resolveDraft({ title, content: text }, { content: "legacy", base: null })).toEqual({
        kind: "apply",
        content: "legacy",
      })
    }
  })

  it("reports a conflict for a legacy draft that differs from a saved document: it is usually older", () => {
    const conflict = { kind: "conflict" }
    expect(resolveDraft({ title: "Title", content: text }, { content: "legacy", base: null })).toEqual(conflict)
    expect(resolveDraft({ title: " T ", content: text }, { content: "", base: null })).toEqual(conflict)
  })

  it("applies a v1 draft whose base is the server content's hash, including an empty draft, whatever the title", () => {
    const base = hashContent(text)
    for (const title of ["Title", ...blankTitles]) {
      const server = { title, content: text }
      expect(resolveDraft(server, { content: "local", base })).toEqual({ kind: "apply", content: "local" })
      expect(resolveDraft(server, { content: "", base })).toEqual({ kind: "apply", content: "" })
    }
  })

  it("reports a conflict for a v1 draft whose base is another server content, whatever the title", () => {
    const stale = { content: "local", base: hashContent("older") }
    for (const title of ["Title", ...blankTitles]) {
      expect(resolveDraft({ title, content: text }, stale)).toEqual({ kind: "conflict" })
    }
  })
})

describe("writeDraft, clearDraft, removeIfUnchanged, stashConflict and discardRead", () => {
  it("writeDraft stores the envelope under the v1 key and returns the raw value written", () => {
    const storage = makeStorage()
    const raw = writeDraft(storage, A, { content: "text", base: "4:x" })
    expect(raw).toBe(v1("4:x", "text"))
    expect(storage.sets).toEqual([{ key: draftKey(A), value: v1("4:x", "text") }])
    expect(storage.getItem(legacyDraftKey(A))).toBeNull()
    expect(parseDraft(raw)).toEqual({ content: "text", base: "4:x" })
  })

  it("never throws: a null storage, a blocked storage and a refused write all degrade to null", () => {
    const refusing = makeStorage({ [draftKey(A)]: "older" })
    refusing.refuseWrites = true
    expect(writeDraft(null, A, { content: "t", base: "b" })).toBeNull()
    expect(writeDraft(makeBrokenStorage(), A, { content: "t", base: "b" })).toBeNull()
    expect(writeDraft(refusing, A, { content: "t", base: "b" })).toBeNull()
    expect(refusing.getItem(draftKey(A))).toBe("older")
    expect(() => clearDraft(null, A, "x")).not.toThrow()
    expect(() => clearDraft(makeBrokenStorage(), A, "x")).not.toThrow()
    expect(() => removeIfUnchanged(null, "k", "x")).not.toThrow()
  })

  it("removeIfUnchanged removes the key only while it still holds the given raw value", () => {
    const storage = makeStorage({ k: "mine", other: "mine" })
    removeIfUnchanged(storage, "k", "someone else's")
    expect(storage.getItem("k")).toBe("mine")
    removeIfUnchanged(storage, "k", "mine")
    expect(storage.getItem("k")).toBeNull()
    expect(storage.getItem("other")).toBe("mine")
  })

  it("clearDraft removes this document's draft only while it holds the owned value", () => {
    const storage = makeStorage({ [draftKey(A)]: v1("1:a", "x"), [draftKey(B)]: v1("1:a", "x") })
    clearDraft(storage, A, v1("1:a", "newer"))
    expect(storage.getItem(draftKey(A))).toBe(v1("1:a", "x"))
    clearDraft(storage, A, v1("1:a", "x"))
    expect(storage.getItem(draftKey(A))).toBeNull()
    expect(storage.getItem(draftKey(B))).toBe(v1("1:a", "x"))
  })

  it("clearDraft with no ownership leaves an existing draft alone", () => {
    const storage = makeStorage({ [draftKey(A)]: "theirs" })
    clearDraft(storage, A, null)
    expect(storage.getItem(draftKey(A))).toBe("theirs")
  })

  it("stashConflict keeps the text in its own slot, one per document, and reports that it did", () => {
    const storage = makeStorage({ [draftKey(A)]: v1("1:a", "draft") })
    expect(stashConflict(storage, A, "first")).toBe(true)
    expect(stashConflict(storage, A, "second")).toBe(true)
    expect(storage.getItem(conflictKey(A))).toBe("second")
    expect(storage.getItem(draftKey(A))).toBe(v1("1:a", "draft"))
    expect(storage.getItem(conflictKey(B))).toBeNull()
  })

  it("stashConflict reports false when the storage is null, blocked or refuses the write", () => {
    const refusing = makeStorage()
    refusing.refuseWrites = true
    expect(stashConflict(refusing, A, "text")).toBe(false)
    expect(refusing.getItem(conflictKey(A))).toBeNull()
    expect(stashConflict(null, A, "text")).toBe(false)
    expect(stashConflict(makeBrokenStorage(), A, "text")).toBe(false)
  })

  it("discardRead removes the key the draft was read from, and only while unchanged", () => {
    const storage = makeStorage({
      [draftKey(A)]: v1("1:a", "x"),
      [legacyDraftKey(A)]: "kept",
      [legacyDraftKey(B)]: "old",
    })
    const read = (raw: string, legacy: boolean): ReadDraft => ({ draft: { content: "", base: null }, raw, legacy })
    discardRead(storage, A, read("different", false))
    expect(storage.getItem(draftKey(A))).toBe(v1("1:a", "x"))
    discardRead(storage, A, read(v1("1:a", "x"), false))
    expect(storage.getItem(draftKey(A))).toBeNull()
    expect(storage.getItem(legacyDraftKey(A))).toBe("kept")
    discardRead(storage, B, read("newer", true))
    expect(storage.getItem(legacyDraftKey(B))).toBe("old")
    discardRead(storage, B, read("old", true))
    expect(storage.getItem(legacyDraftKey(B))).toBeNull()
  })

  it("discardRead never throws on a null or blocked storage", () => {
    const read: ReadDraft = { draft: { content: "x", base: null }, raw: "x", legacy: true }
    expect(() => discardRead(null, A, read)).not.toThrow()
    expect(() => discardRead(makeBrokenStorage(), A, read)).not.toThrow()
  })
})

describe("getBrowserStorage", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("returns window.localStorage", () => {
    const storage = makeStorage()
    vi.stubGlobal("window", { localStorage: storage })
    expect(getBrowserStorage()).toBe(storage)
  })

  it("returns null when reading the property throws, as a browser with storage blocked does", () => {
    const blocked = Object.defineProperty({}, "localStorage", {
      get() {
        throw new Error("blocked")
      },
    })
    vi.stubGlobal("window", blocked)
    expect(getBrowserStorage()).toBeNull()
  })

  it("returns null without a window, as in a server render", () => {
    expect(typeof window).toBe("undefined")
    expect(getBrowserStorage()).toBeNull()
    vi.stubGlobal("window", undefined)
    expect(getBrowserStorage()).toBeNull()
  })
})
