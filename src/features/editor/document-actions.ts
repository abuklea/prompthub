/*
Project: PromptHub
Author: Allan James
Source: src/features/editor/document-actions.ts
MIME: text/typescript
Type: TypeScript

Created: 22/10/2026 10:06 GMT+10
Last modified: 22/10/2026 10:06 GMT+10
---------------
The server actions the editor's persistence hooks call, as an injected interface (contract: Types and Interfaces).
EditorPane builds the real implementation as a module-level constant; the hooks import no server code, so a test
can drive them from a fake server.

Changelog:
22/10/2026 10:06 GMT+10 | Created with the DocumentActions interface (P7S1T7 step 1)
*/

import type { ActionResult } from "@/types/actions"
import type { PromptVersionHistoryItem } from "@/features/prompts/types"

/**
 * The four document actions the editor sends. Implementations resolve with an `ActionResult`; a failure is reported as
 * `{ success: false, error }`, and a rejected promise (offline, a deploy skew) is possible and is the caller's to
 * handle. Pass a stable object (a module-level constant): the hooks build their callbacks from it.
 */
export interface DocumentActions {
  /**
   * Saves the document and records a version.
   * @param input - The document, the title to save (a valid, non-placeholder title) and the content.
   * @returns The new version's id on success; an error message otherwise.
   */
  saveNewVersion(
    input: { promptId: string; newTitle: string; newContent: string }
  ): Promise<ActionResult<{ versionId: number }>>
  /**
   * Writes the document's title and content without recording a version.
   * @param input - The document, its working title and its working content.
   * @returns Success with no data; an error message otherwise.
   */
  autoSavePrompt(input: { promptId: string; title: string; content: string }): Promise<ActionResult<void>>
  /**
   * Restores the document to the state a version holds.
   * @param input - The document and the version to restore.
   * @returns The restored title and content on success; an error message otherwise.
   */
  restorePromptVersion(
    input: { promptId: string; versionId: number }
  ): Promise<ActionResult<{ title: string | null; content: string }>>
  /**
   * Lists the document's versions, newest first. Read by the history dialog, not by the persistence hooks.
   * @param input - The document.
   * @returns The version list on success; an error message otherwise.
   */
  getPromptVersionHistory(input: { promptId: string }): Promise<ActionResult<PromptVersionHistoryItem[]>>
}
