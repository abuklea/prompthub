/*
Project: PromptHub
Author: Allan James
Source: src/features/folders/actions.ts
MIME: text/typescript
Type: TypeScript

Created: 06/11/2025 14:33 GMT+10
Last modified: 29/10/2026 20:47 GMT+10
---------------
Server actions for folders: listing the root folders and a folder's children, and creating, renaming and deleting a
folder. Each is a thin wrapper over its handler in handlers.ts and returns an ActionResult; none throws for a failure.
Deleting returns every folder id and prompt id the delete removed, so the caller can purge its caches and close tabs.

Changelog:
29/10/2026 20:47 GMT+10 | P7S2T5: the five actions are wrappers over handlers.ts; each takes one object argument
                         (getRootFolders none) and returns an ActionResult; the positional signatures and the thrown
                         errors are removed (issue #113)
29/10/2026 20:05 GMT+10 | P7S2T1: createFolder passes the database client to ensureProfileExists; header added
06/11/2025 14:33 GMT+10 | Created (commit fb2faa7)
*/

"use server"

import { revalidatePath } from "next/cache"
import { actionDeps } from "@/lib/action-runtime"
import * as handlers from "./handlers"
import type { CreateFolderInput, DeleteFolderInput, GetFolderChildrenInput, RenameFolderInput } from "./schemas"

/** The caller's root folders by name. */
export async function getRootFolders() {
  return handlers.getRootFolders(actionDeps, undefined)
}

/** Create a folder at the root or under one of the caller's folders. */
export async function createFolder(data: CreateFolderInput) {
  const result = await handlers.createFolder(actionDeps, data)
  if (result.success) revalidatePath("/")
  return result
}

/** Rename one of the caller's folders. */
export async function renameFolder(data: RenameFolderInput) {
  const result = await handlers.renameFolder(actionDeps, data)
  if (result.success) revalidatePath("/")
  return result
}

/** Delete one of the caller's folders with its descendants and their prompts; returns every removed id. */
export async function deleteFolder(data: DeleteFolderInput) {
  const result = await handlers.deleteFolder(actionDeps, data)
  if (result.success) revalidatePath("/")
  return result
}

/** The caller's folders under a parent by name; a foreign parent gives an empty list. */
export async function getFolderChildren(data: GetFolderChildrenInput) {
  return handlers.getFolderChildren(actionDeps, data)
}
