"use server"

import db from "@/lib/db"
import { createServer } from "@/lib/supabase"
import { revalidatePath } from "next/cache"

export async function getRootFolders() {
  const supabase = createServer()
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
  const supabase = createServer()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    throw new Error("User not found")
  }

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
  const supabase = createServer()
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
  const supabase = createServer()
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
  const supabase = createServer()
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
