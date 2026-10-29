/*
Project: PromptHub
Author: Allan James
Source: src/features/folders/actions.ts
MIME: text/typescript
Type: TypeScript

Created: 06/11/2025 14:33 GMT+10
Last modified: 29/10/2026 20:05 GMT+10
---------------
Server actions for folders: listing the root folders and a folder's children, and creating, renaming and deleting a
folder. Deleting returns the ids of the prompts the folder held, so the caller can close their tabs.

Changelog:
29/10/2026 20:05 GMT+10 | P7S2T1: createFolder passes the database client to ensureProfileExists; header added
06/11/2025 14:33 GMT+10 | Created (commit fb2faa7)
*/

"use server"

import db from "@/lib/db"
import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { ensureProfileExists } from "@/lib/ensure-profile"

export async function getRootFolders() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    throw new Error("User not found")
  }

  return await db.folder.findMany({
    where: {
      user_id: user.id,
      parent_id: null,
    },
    orderBy: {
      name: "asc",
    },
  })
}

export async function createFolder(name: string, parentId: string | null) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    throw new Error("User not found")
  }

  await ensureProfileExists(db, user.id)

  const newFolder = await db.folder.create({
    data: {
      name,
      user_id: user.id,
      parent_id: parentId,
    },
  })

  revalidatePath("/")
  return newFolder
}

export async function renameFolder(folderId: string, newName: string) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    throw new Error("User not found")
  }

  const updatedFolder = await db.folder.update({
    where: {
      id: folderId,
      user_id: user.id,
    },
    data: {
      name: newName,
    },
  })

  revalidatePath("/")
  return updatedFolder
}

export async function deleteFolder(folderId: string) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    throw new Error("User not found")
  }

  // Reason: Get all prompts in this folder BEFORE deleting
  // so we can return their IDs to close related tabs
  const prompts = await db.prompt.findMany({
    where: {
      folder_id: folderId,
      user_id: user.id,
    },
    select: {
      id: true,
    },
  })

  const promptIds = prompts.map(p => p.id)

  await db.folder.delete({
    where: {
      id: folderId,
      user_id: user.id,
    },
  })

  revalidatePath("/")

  // Return prompt IDs so caller can close related tabs
  return promptIds
}

export async function getFolderChildren(parentId: string) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    throw new Error("User not found")
  }

  return await db.folder.findMany({
    where: {
      user_id: user.id,
      parent_id: parentId,
    },
    orderBy: {
      name: "asc",
    },
  })
}
