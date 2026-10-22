/*
Project: PromptHub
Author: Allan James
Source: src/features/editor/document-actions.test.ts
MIME: text/typescript
Type: TypeScript test (Vitest, node)

Created: 22/10/2026 10:17 GMT+10
Last modified: 22/10/2026 10:17 GMT+10
---------------
withActionTimeout (contract: Async Completions and Failures): each of the four document actions is limited to the
request timeout, so a request that never settles rejects with REQUEST_TIMED_OUT at the limit and not before, while an
answer or a rejection that arrives in time passes through unchanged and leaves no timer behind. Fake timers.

Changelog:
22/10/2026 10:17 GMT+10 | Created (P7S1T7 step 2)
*/

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { REQUEST_TIMED_OUT, REQUEST_TIMEOUT_MS } from "./request-timeout"
import { withActionTimeout, type DocumentActions } from "./document-actions"

type Name = keyof DocumentActions

const NAMES: Name[] = ["saveNewVersion", "autoSavePrompt", "restorePromptVersion", "getPromptVersionHistory"]

/** A valid input for each action. */
const INPUTS = {
  saveNewVersion: { promptId: "p1", newTitle: "Title", newContent: "text" },
  autoSavePrompt: { promptId: "p1", title: "Title", content: "text" },
  restorePromptVersion: { promptId: "p1", versionId: 3 },
  getPromptVersionHistory: { promptId: "p1" },
} satisfies { [N in Name]: Parameters<DocumentActions[N]>[0] }

/** Sends one action with its valid input. */
function send(actions: DocumentActions, name: Name): Promise<unknown> {
  switch (name) {
    case "saveNewVersion":
      return actions.saveNewVersion(INPUTS.saveNewVersion)
    case "autoSavePrompt":
      return actions.autoSavePrompt(INPUTS.autoSavePrompt)
    case "restorePromptVersion":
      return actions.restorePromptVersion(INPUTS.restorePromptVersion)
    case "getPromptVersionHistory":
      return actions.getPromptVersionHistory(INPUTS.getPromptVersionHistory)
  }
}

/** Records how a promise settled: "pending", its value, or the message it rejected with. */
function track(promise: Promise<unknown>): { outcome: unknown } {
  const state: { outcome: unknown } = { outcome: "pending" }
  promise.then(
    (value) => {
      state.outcome = value
    },
    (error: Error) => {
      state.outcome = error.message
    }
  )
  return state
}

/** Actions none of which ever settles, as an action orphaned in Next's queue. */
function stuckActions(): DocumentActions {
  const never = <T>() => new Promise<T>(() => {})
  return {
    saveNewVersion: () => never(),
    autoSavePrompt: () => never(),
    restorePromptVersion: () => never(),
    getPromptVersionHistory: () => never(),
  }
}

/** Actions that answer at once with a success, and record the inputs they received. */
function answeringActions(received: unknown[]): DocumentActions {
  return {
    saveNewVersion: async (input) => (received.push(input), { success: true, data: { versionId: 7 } }),
    autoSavePrompt: async (input) => (received.push(input), { success: true, data: undefined }),
    restorePromptVersion: async (input) => (received.push(input), { success: true, data: { title: "T", content: "" } }),
    getPromptVersionHistory: async (input) => (received.push(input), { success: true, data: [] }),
  }
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => vi.useRealTimers())

describe("withActionTimeout", () => {
  it.each(NAMES)("%s: a request that never settles rejects with the timeout message at the limit", async (name) => {
    const pending = track(send(withActionTimeout(stuckActions(), 1000), name))
    await vi.advanceTimersByTimeAsync(999)
    expect(pending.outcome).toBe("pending")
    await vi.advanceTimersByTimeAsync(1)
    expect(pending.outcome).toBe(REQUEST_TIMED_OUT)
  })

  it.each(NAMES)("%s: an answer in time passes through with its input unchanged and no timer left", async (name) => {
    const received: unknown[] = []
    const expected = await send(answeringActions(received), name)
    received.length = 0
    const answer = track(send(withActionTimeout(answeringActions(received), 1000), name))
    await vi.advanceTimersByTimeAsync(0)
    expect(answer.outcome).toEqual(expected)
    expect(received).toEqual([INPUTS[name]])
    expect(vi.getTimerCount()).toBe(0)
  })

  it("a rejection in time passes through", async () => {
    const actions: DocumentActions = { ...stuckActions(), autoSavePrompt: () => Promise.reject(new Error("Offline")) }
    const outcome = track(withActionTimeout(actions, 1000).autoSavePrompt(INPUTS.autoSavePrompt))
    await vi.advanceTimersByTimeAsync(0)
    expect(outcome.outcome).toBe("Offline")
    expect(vi.getTimerCount()).toBe(0)
  })

  it("the default limit is REQUEST_TIMEOUT_MS", async () => {
    const pending = track(withActionTimeout(stuckActions()).saveNewVersion(INPUTS.saveNewVersion))
    await vi.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS - 1)
    expect(pending.outcome).toBe("pending")
    await vi.advanceTimersByTimeAsync(1)
    expect(pending.outcome).toBe(REQUEST_TIMED_OUT)
  })
})
