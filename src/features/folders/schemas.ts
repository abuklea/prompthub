/*
Project: PromptHub
Author: Allan James
Source: src/features/folders/schemas.ts
MIME: text/typescript
Type: TypeScript Module

Created: 29/10/2026 20:44 GMT+10
Last modified: 29/10/2026 20:44 GMT+10
---------------
Zod schemas for the input of the folder actions, and the input types their wrappers accept. Every string is trimmed
before it is bounded, so a name of spaces is refused rather than stored empty.

Changelog:
29/10/2026 20:44 GMT+10 | Created (P7S2T5, issue #113)
*/
import { z } from "zod"

const folderId = z.string().uuid("Invalid folder ID")

// Reason: trim before min and max; in Zod 3 `.min(1).trim()` accepts "  " and returns "".
const folderName = z.string().trim().min(1, "Folder name is required").max(100, "Folder name is too long")

/** createFolder: a name and the parent folder's id, or null for a root folder. */
export const createFolderSchema = z.object({ name: folderName, parentId: folderId.nullable() })

/** renameFolder: the folder's id and its new name. */
export const renameFolderSchema = z.object({ folderId, name: folderName })

/** deleteFolder: the id of the folder whose tree is deleted. */
export const deleteFolderSchema = z.object({ folderId })

/** getFolderChildren: the id of the parent folder. */
export const getFolderChildrenSchema = z.object({ parentId: folderId })

/** getRootFolders and the other actions that take no argument. */
export const noInputSchema = z.undefined()

/** What a caller passes to createFolder. */
export type CreateFolderInput = z.input<typeof createFolderSchema>

/** What a caller passes to renameFolder. */
export type RenameFolderInput = z.input<typeof renameFolderSchema>

/** What a caller passes to deleteFolder. */
export type DeleteFolderInput = z.input<typeof deleteFolderSchema>

/** What a caller passes to getFolderChildren. */
export type GetFolderChildrenInput = z.input<typeof getFolderChildrenSchema>
