// @vitest-environment jsdom
/*
Project: PromptHub
Author: Allan James
Source: src/features/editor/hooks/useDocumentLoader.editing.test.tsx
MIME: text/typescript
Type: TypeScript React test (Vitest, jsdom)

Created: 22/10/2026 09:21 GMT+10
Last modified: 22/10/2026 09:21 GMT+10
---------------
Edits through the loader's setters: setTitle and setContent, with a value or an updater, change the working copy only;
the baseline, promptData and readiness stay, so the working copy reads as unsaved until a write is recorded.

Changelog:
22/10/2026 09:21 GMT+10 | Created (P7S1T5 step 3)
*/

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { act, cleanup } from "@testing-library/react"
import { clearDocumentCache } from "@/features/editor/document-cache"
import { A, makeDeferredIo, mountLoader as mount, serverRow } from "@/test/loader-world"

beforeEach(() => {
  clearDocumentCache()
  localStorage.clear()
})

afterEach(() => {
  vi.useRealTimers()
  cleanup()
})

describe("useDocumentLoader setters", () => {
  it("change the working title and content and leave the baseline, promptData and readiness", async () => {
    const t = makeDeferredIo(act)
    const { result } = mount(t.io)
    await t.resolveUser()
    await t.resolveFetch(A, serverRow(A, "Server title", "Server content"))

    act(() => {
      result.current.setTitle("Edited title")
      result.current.setContent("Edited")
    })
    act(() => {
      result.current.setTitle((previous) => `${previous ?? ""}!`)
      result.current.setContent((previous) => `${previous} text`)
    })

    expect(result.current.title).toBe("Edited title!")
    expect(result.current.content).toBe("Edited text")
    expect(result.current.ready).toBe(true)
    expect(result.current.synced).toEqual({ promptId: A, title: "Server title", content: "Server content" })
    expect(result.current.promptData).toMatchObject({ title: "Server title", content: "Server content" })
  })
})
