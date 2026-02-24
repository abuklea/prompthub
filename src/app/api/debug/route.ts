import { NextResponse } from "next/server"
import db from "@/lib/db"
import { createServer } from "@/lib/supabase"

export async function GET() {
  const results: Record<string, unknown> = {}

  // Test 1: Environment variables (show host:port only, no credentials)
  const dbUrl = process.env.DATABASE_URL ?? ""
  const directUrl = process.env.DIRECT_URL ?? ""
  const extractHostPort = (url: string) => {
    try {
      const match = url.match(/@([^/]+)/)
      return match ? match[1] : "PARSE_ERROR"
    } catch { return "PARSE_ERROR" }
  }
  results.env = {
    DATABASE_URL: dbUrl ? `SET → ${extractHostPort(dbUrl)}` : "MISSING",
    DIRECT_URL: directUrl ? `SET → ${extractHostPort(directUrl)}` : "MISSING",
    SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ? "SET" : "MISSING",
    SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? "SET" : "MISSING",
  }

  // Test 2: Prisma connection
  try {
    const count = await db.folder.count()
    results.prisma = { status: "OK", folderCount: count }
  } catch (error) {
    results.prisma = {
      status: "ERROR",
      message: error instanceof Error ? error.message : String(error),
      name: error instanceof Error ? error.name : "Unknown",
    }
  }

  // Test 3: Supabase auth
  try {
    const supabase = createServer()
    const { data, error } = await supabase.auth.getUser()
    results.supabase = {
      status: error ? "ERROR" : "OK",
      user: data?.user?.email ?? null,
      error: error?.message ?? null,
    }
  } catch (error) {
    results.supabase = {
      status: "EXCEPTION",
      message: error instanceof Error ? error.message : String(error),
    }
  }

  return NextResponse.json(results)
}
