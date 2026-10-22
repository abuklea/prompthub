/*
Project: PromptHub
Author: Allan James
Source: src/test/history-dialog.tsx
MIME: text/typescript
Type: TypeScript React test helper

Created: 22/10/2026 10:39 GMT+10
Last modified: 22/10/2026 10:39 GMT+10
---------------
The helpers the VersionHistoryDialog suites share: history reads and restores the test settles by hand, a parent that
sets `open` from a button as EditorPane's History button does, and the queries and gestures on the real Radix dialogs.
Every helper that needs an earlier step to have happened (a read, a row, the question) checks it with an assertion, so
a test against a dialog that never loads its list fails on that assertion instead of a TypeError.

Changelog:
22/10/2026 10:39 GMT+10 | Created from the helpers of the P7S1 dialog spike suite (P7S1T8 step 2)
*/

import { useState } from "react"
import { expect } from "vitest"
import { act, fireEvent, screen, within } from "@testing-library/react"
import {
  VersionHistoryDialog, type VersionHistoryDialogProps,
} from "@/features/editor/components/VersionHistoryDialog"
import type { PromptVersionHistoryItem } from "@/features/prompts/types"
import type { ActionResult } from "@/types/actions"
import { NOW, defer, type Deferred } from "./loader-world"

/** The result of a history read. */
export type History = ActionResult<PromptVersionHistoryItem[]>

/**
 * Builds a successful history read.
 * @param rows - `[id, title, content]` per snapshot, newest first.
 * @returns The result, every snapshot stamped with `NOW`.
 */
export function history(...rows: Array<[number, string | null, string]>): History {
  return {
    success: true,
    data: rows.map(([id, title, content]) => ({
      id, created_at: NOW, title_snapshot: title, content_snapshot: content,
    })),
  }
}

/** History reads the test settles by hand. */
export interface HistoryFake {
  /** Every read, in call order. */
  calls: Array<{ promptId: string; d: Deferred<History> }>
  /** The `loadHistory` to inject. */
  loadHistory: VersionHistoryDialogProps["loadHistory"]
  /** Fulfils read `index` inside `act`; asserts that the read happened. */
  answer(index: number, value: History): Promise<void>
  /** Rejects read `index` inside `act`, as a dropped connection does; asserts that the read happened. */
  reject(index: number): Promise<void>
}

/** @returns A history fake with no read yet. */
export function makeHistory(): HistoryFake {
  const calls: HistoryFake["calls"] = []
  const settle = async (index: number, apply: (d: Deferred<History>) => void) => {
    expect(calls.length, `history read ${index} was requested`).toBeGreaterThan(index)
    await act(async () => {
      apply(calls[index].d)
    })
  }
  return {
    calls,
    loadHistory: (promptId) => {
      const d = defer<History>()
      calls.push({ promptId, d })
      return d.promise
    },
    answer: (index, value) => settle(index, (d) => d.resolve(value)),
    reject: (index) => settle(index, (d) => d.reject(new Error("offline"))),
  }
}

/** Restores the test settles by hand. */
export interface RestorerFake {
  /** Every restore, in call order. */
  calls: Array<{ versionId: number; d: Deferred<boolean> }>
  /** The `onRestore` to inject. */
  onRestore: VersionHistoryDialogProps["onRestore"]
  /** Resolves restore `index` inside `act`; asserts that the restore happened. */
  finish(index: number, result: boolean): Promise<void>
}

/** @returns A restore fake with no restore yet. */
export function makeRestorer(): RestorerFake {
  const calls: RestorerFake["calls"] = []
  return {
    calls,
    onRestore: (versionId) => {
      const d = defer<boolean>()
      calls.push({ versionId, d })
      return d.promise
    },
    finish: async (index, result) => {
      expect(calls.length, `restore ${index} was requested`).toBeGreaterThan(index)
      await act(async () => {
        calls[index].d.resolve(result)
      })
    },
  }
}

/** The props of `Harness`. */
export interface HarnessProps {
  /** The document whose history the dialog lists. */
  promptId: string | null
  /** The injected history read. */
  loadHistory: VersionHistoryDialogProps["loadHistory"]
  /** The injected restore. */
  onRestore: VersionHistoryDialogProps["onRestore"]
  /** Collects every `onOpenChange` the dialog reports. */
  changes?: boolean[]
}

/**
 * The parent of the dialog: a button sets `open`, as EditorPane's History button does.
 * @param props - The document, the injected reads and the change log.
 * @returns The two parent buttons and the dialog.
 */
export function Harness({ promptId, loadHistory, onRestore, changes }: HarnessProps) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button onClick={() => setOpen(true)}>Open history</button>
      <button onClick={() => setOpen(false)}>Close from the parent</button>
      <VersionHistoryDialog
        promptId={promptId}
        open={open}
        onOpenChange={(next) => {
          changes?.push(next)
          setOpen(next)
        }}
        loadHistory={loadHistory}
        onRestore={onRestore}
      />
    </>
  )
}

/** Presses the parent's button that opens the history. */
export const openHistory = (): void => {
  fireEvent.click(screen.getByRole("button", { name: "Open history" }))
}
/** Presses Escape on the document body. */
export const pressEscape = (): void => {
  fireEvent.keyDown(document.body, { key: "Escape" })
}
/** @returns The reachable Restore and Restoring buttons, in list order. */
export const restoreButtons = (): HTMLButtonElement[] =>
  screen.queryAllByRole<HTMLButtonElement>("button", { name: /^Restor/ })
/** @returns True while the history dialog is in the document. */
export const isOpen = (): boolean => screen.queryByRole("dialog") !== null
/** @returns The history dialog's overlay. */
export const overlay = (): HTMLElement => {
  const element = document.querySelector<HTMLElement>(".fixed.inset-0")
  expect(element, "the overlay is rendered").not.toBeNull()
  return element as HTMLElement
}
/**
 * The "Restore this version?" question. Radix hides the history behind it while it is open, and hides it behind the
 * history when both open together, so the query ignores aria-hidden: a question in the DOM counts even if no user could
 * reach it.
 * @returns The question, or null.
 */
export const question = (): HTMLElement | null => screen.queryByRole("alertdialog", { hidden: true })
/**
 * Clicks Restore on a row; asserts the row exists.
 * @param index - The row, in list order.
 */
export const askRestore = (index: number): void => {
  const buttons = restoreButtons()
  expect(buttons.length, `a Restore button at row ${index}`).toBeGreaterThan(index)
  fireEvent.click(buttons[index])
}
/**
 * Answers the question; asserts it is asked.
 * @param name - The button to press.
 */
export const answer = (name: "Restore" | "Cancel"): void => {
  const asked = screen.queryByRole("alertdialog")
  expect(asked, "the question 'Restore this version?' is asked").not.toBeNull()
  fireEvent.click(within(asked as HTMLElement).getByRole("button", { name }))
}
/**
 * What a user does to restore: Restore on a row, then Restore on the question.
 * @param index - The row, in list order.
 */
export const restoreRow = (index: number): void => {
  askRestore(index)
  answer("Restore")
}
