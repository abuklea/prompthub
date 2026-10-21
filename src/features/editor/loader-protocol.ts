/*
Project: PromptHub
Author: Allan James
Source: src/features/editor/loader-protocol.ts
MIME: text/typescript
Type: TypeScript

Created: 22/10/2026 08:57 GMT+10
Last modified: 22/10/2026 08:57 GMT+10
---------------
The document loader protocol. It currently holds only the io contract: the seam through which the loader fetches a
document, looks up the signed-in user and reaches the browser storage, so tests can drive the loader from fakes.

Changelog:
22/10/2026 08:57 GMT+10 | Created with the DocumentLoaderIo contract (P7S1T5 step 1)
*/

import type { ActionResult } from "@/types/actions"
import type { DraftStorage } from "./draft"

/**
 * The outside world the document loader reads: the server, the session and the browser storage. The real
 * implementation is a module-level constant in `EditorPane`, so its identity is stable across renders; a test passes
 * fakes.
 */
export interface DocumentLoaderIo {
  /**
   * Fetches a document with its folder. Real: `(promptId) => withTimeout(getPromptDetails({ promptId }))`.
   * @param promptId - The document to fetch.
   * @returns The action's result; on success its `data` is the prompt row with its folder.
   * @throws The fetch's rejection, or the `withTimeout` error when the request takes longer than its limit.
   */
  fetchPrompt(promptId: string): Promise<ActionResult>
  /**
   * Looks up the signed-in user in the browser. Looked up on every mount and never remembered.
   * @returns The user's id, or `ANONYMOUS` when there is no session or the lookup fails. Never rejects.
   */
  getUserId(): Promise<string>
  /**
   * Returns the browser storage that holds drafts. Real: `getBrowserStorage`. Called inside effects only.
   * @returns The storage, or null on the server and when the browser blocks it.
   */
  getStorage(): DraftStorage | null
}
