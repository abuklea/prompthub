// @vitest-environment jsdom
// @ts-nocheck -- research probe: it imports jsdom-era test packages that P7S1T1 adds to package.json; until then CI
// would fail to resolve them, and tsconfig.json includes every .tsx file. Reconciled or deleted when P7S1 is reported.
/*
Project: PromptHub
Author: Allan James
Source: wip/P7S1-loader-race-diagnostic.test.tsx
MIME: text/typescript
Type: TypeScript React diagnostic test (throwaway, not part of the suite)

Created: 20/10/2026 11:43 GMT+10
Last modified: 20/10/2026 12:02 GMT+10
---------------
P7S1 research diagnostic. Drives the CURRENT useDocumentLoader with controllable promises to find out what the hook
holds when the browser user id resolves before the document fetch, and when it resolves after. Module mocks are
acceptable here only because this file is a research probe that is never run by `npm test`
(docs/rules/testing.md#rules governs committed suites).
Run with: npx vitest run --config wip/P7S1-vitest.diag.config.ts (needs jsdom, @testing-library/react and
@testing-library/dom installed, for example with `npm install --no-save`).

Changelog:
20/10/2026 12:02 GMT+10 | Added the ts-nocheck line and the run instructions
20/10/2026 11:45 GMT+10 | Added the control and React Strict Mode scenarios
20/10/2026 11:43 GMT+10 | Created for P7S1 research
*/

import { StrictMode } from "react"
import { describe, it, expect, vi } from "vitest"
import { renderHook, act } from "@testing-library/react"

const h = vi.hoisted(() => {
  function defer<T>() {
    let resolve!: (value: T) => void
    const promise = new Promise<T>((r) => {
      resolve = r
    })
    return { promise, resolve }
  }
  return {
    defer,
    user: null as unknown as ReturnType<typeof defer<{ data: { user: { id: string } } }>>,
    fetched: null as unknown as ReturnType<typeof defer<unknown>>,
    fetchCalls: 0,
  }
})

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ auth: { getUser: () => h.user.promise } }),
}))

vi.mock("@/features/prompts/actions", () => ({
  getPromptDetails: () => {
    h.fetchCalls += 1
    return h.fetched.promise
  },
}))

import { useDocumentLoader } from "@/features/editor/hooks/useDocumentLoader"

const PROMPT_ID = "11111111-1111-4111-8111-111111111111"

function serverResult() {
  const now = new Date("2026-10-20T01:00:00.000Z")
  return {
    success: true,
    data: {
      id: PROMPT_ID,
      title: "Server title",
      content: "Server content",
      created_at: now,
      updated_at: now,
      user_id: "user-1",
      folder_id: "folder-1",
      folder: { id: "folder-1", name: "Folder" },
      tags: [],
    },
  }
}

async function flush() {
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
  })
}

function snapshot(label: string, state: ReturnType<typeof useDocumentLoader>) {
  console.log(
    `[diag] ${label}: loading=${state.loading} title=${JSON.stringify(state.title)} ` +
      `content=${JSON.stringify(state.content)} error=${JSON.stringify(state.error)} fetchCalls=${h.fetchCalls}`
  )
}

describe("current useDocumentLoader, uncached first open", () => {
  it("A: user id resolves BEFORE the document fetch", async () => {
    h.user = h.defer()
    h.fetched = h.defer()
    h.fetchCalls = 0
    localStorage.clear()

    const { result } = renderHook(() => useDocumentLoader({ promptId: PROMPT_ID }))
    snapshot("A after mount", result.current)

    await act(async () => {
      h.user.resolve({ data: { user: { id: "user-1" } } })
    })
    await flush()
    snapshot("A after user id resolved", result.current)

    await act(async () => {
      h.fetched.resolve(serverResult())
    })
    await flush()
    snapshot("A after fetch resolved", result.current)

    expect(result.current.content).toBe("Server content")
  })

  it("C (control): switching documents on a mounted instance after the user id is known DOES load", async () => {
    h.user = h.defer()
    h.fetched = h.defer()
    h.fetchCalls = 0
    localStorage.clear()

    const { result, rerender } = renderHook((props: { promptId: string }) => useDocumentLoader(props), {
      initialProps: { promptId: "00000000-0000-4000-8000-000000000001" },
    })
    await act(async () => {
      h.user.resolve({ data: { user: { id: "user-1" } } })
    })
    await flush()
    snapshot("C after mount + user id (first doc, fetch pending)", result.current)

    h.fetched = h.defer()
    rerender({ promptId: PROMPT_ID })
    await act(async () => {
      h.fetched.resolve(serverResult())
    })
    await flush()
    snapshot("C after switching to second doc and fetch resolved", result.current)

    expect(result.current.content).toBe("Server content")
  })

  it("D: React StrictMode (the Next.js App Router dev default), user id first", async () => {
    h.user = h.defer()
    h.fetched = h.defer()
    h.fetchCalls = 0
    localStorage.clear()

    const { result } = renderHook(() => useDocumentLoader({ promptId: PROMPT_ID }), { wrapper: StrictMode })
    snapshot("D after mount", result.current)

    await act(async () => {
      h.user.resolve({ data: { user: { id: "user-1" } } })
    })
    await act(async () => {
      h.fetched.resolve(serverResult())
    })
    await flush()
    snapshot("D after user id and fetch resolved", result.current)

    expect(result.current.content).toBe("Server content")
  })

  it("B: user id resolves AFTER the document fetch", async () => {
    h.user = h.defer()
    h.fetched = h.defer()
    h.fetchCalls = 0
    localStorage.clear()

    const { result } = renderHook(() => useDocumentLoader({ promptId: PROMPT_ID }))
    snapshot("B after mount", result.current)

    await act(async () => {
      h.fetched.resolve(serverResult())
    })
    await flush()
    snapshot("B after fetch resolved", result.current)

    await act(async () => {
      h.user.resolve({ data: { user: { id: "user-1" } } })
    })
    await flush()
    snapshot("B after user id resolved", result.current)

    expect(result.current.content).toBe("Server content")
  })
})
