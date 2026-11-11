/*
Project: PromptHub
Author: Allan James
Source: src/app/(app)/dashboard/page.tsx
MIME: text/typescript
Type: TypeScript React Component

Created: 06/11/2025 14:28 GMT+10
Last modified: 29/10/2026 20:59 GMT+10
---------------
The dashboard, a Server Component: the signed-in user's prompt, folder and version counts and their recently updated
prompts, read with getDashboardMetrics. A failed result renders zero counts and an empty recent list.

Changelog:
29/10/2026 20:59 GMT+10 | P7S2T8: getDashboardMetrics returns ActionResult; a failure renders EMPTY_METRICS; header
                         added
06/11/2025 14:28 GMT+10 | Created (commit 010f7d1)
*/

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { getDashboardMetrics } from "@/features/dashboard/actions"
import type { DashboardMetrics } from "@/features/dashboard/handlers"

/** What the page shows when the metrics cannot be read: zero counts and no recent prompts. */
const EMPTY_METRICS: DashboardMetrics = {
  totalPrompts: 0,
  totalFolders: 0,
  totalVersions: 0,
  recentlyUpdatedPrompts: [],
}

function formatRelativeDate(date: Date) {
  const now = new Date().getTime()
  const diffMs = now - new Date(date).getTime()
  const minutes = Math.floor(diffMs / 60000)

  if (minutes < 1) return "Just now"
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`

  const days = Math.floor(hours / 24)
  if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`

  return new Date(date).toLocaleDateString()
}

export default async function DashboardPage() {
  const result = await getDashboardMetrics()
  const metrics = result.success ? result.data : EMPTY_METRICS

  return (
    <div className="p-8 space-y-8">
      <h1 className="text-3xl font-bold">Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Total Prompts</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-bold">{metrics.totalPrompts}</p>
            <p className="text-sm text-muted-foreground mt-2">Across all folders</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Total Folders</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-bold">{metrics.totalFolders}</p>
            <p className="text-sm text-muted-foreground mt-2">Nested organization enabled</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Saved Versions</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-bold">{metrics.totalVersions}</p>
            <p className="text-sm text-muted-foreground mt-2">Diff-based history snapshots</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recently Updated Prompts</CardTitle>
        </CardHeader>
        <CardContent>
          {metrics.recentlyUpdatedPrompts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No prompts yet. Create your first prompt to get started.</p>
          ) : (
            <ul className="space-y-3">
              {metrics.recentlyUpdatedPrompts.map((prompt) => (
                <li key={prompt.id} className="flex items-center justify-between border-b pb-3 last:border-0 last:pb-0">
                  <div>
                    <p className="font-medium">{prompt.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {prompt.folderName ? `Folder: ${prompt.folderName}` : "Unfiled"}
                    </p>
                  </div>
                  <p className="text-sm text-muted-foreground">{formatRelativeDate(prompt.updatedAt)}</p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
