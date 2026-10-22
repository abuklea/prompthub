/*
Project: PromptHub
Author: Allan James
Source: src/features/tabs/components/ActiveTabFolderSync.tsx
MIME: text/x-typescript-jsx
Type: TypeScript React Component

Created: 22/10/2026 14:39 GMT+10
Last modified: 22/10/2026 14:39 GMT+10
---------------
Session-wide host of useActiveTabFolderSync. It renders nothing.

Changelog:
22/10/2026 14:39 GMT+10 | Created: the sync moved here from PromptList (#95)
*/

"use client"

import { useActiveTabFolderSync } from "@/features/tabs/hooks/useActiveTabFolderSync"

/**
 * Runs the active-tab folder sync once for the whole app layout.
 *
 * Reason: the sync must have a single host that stays mounted. ResizablePanelsLayout mounts the documents panel twice
 * (the CSS-hidden mobile tree and the desktop tree) and remounts it on every panel switch in the mobile and medium
 * layouts, so hosted in PromptList the sync would run again on each switch and undo a folder the user had just chosen.
 *
 * @returns Nothing: the component only hosts the hook.
 */
export function ActiveTabFolderSync(): null {
  useActiveTabFolderSync()
  return null
}
