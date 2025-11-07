/*
Project: PromptHub
Author: Allan James
Source: src/app/(app)/dashboard/page.tsx
MIME: text/typescript
Type: TypeScript React Component

Created: 07/11/2025 16:18 GMT+10
Last modified: 07/11/2025 16:18 GMT+10
---------------
Dashboard page with placeholder stats cards for future features.

Changelog:
07/11/2025 16:18 GMT+10 | Added placeholder cards (P5S3bT17)
*/

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function DashboardPage() {
  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-8">Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Total Documents Card */}
        <Card>
          <CardHeader>
            <CardTitle>Total Documents</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-bold text-muted-foreground">-</p>
            <p className="text-sm text-muted-foreground mt-2">Coming soon</p>
          </CardContent>
        </Card>

        {/* Recent Activity Card */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Activity feed coming soon
            </p>
          </CardContent>
        </Card>

        {/* Popular Tags Card */}
        <Card>
          <CardHeader>
            <CardTitle>Popular Tags</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Tag system coming soon
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
