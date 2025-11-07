/*
Project: PromptHub
Author: Allan James
Source: src/app/(app)/settings/page.tsx
MIME: text/typescript
Type: TypeScript React Component

Created: 07/11/2025 16:19 GMT+10
Last modified: 07/11/2025 16:19 GMT+10
---------------
Settings page with placeholder controls for future configuration features.

Changelog:
07/11/2025 16:19 GMT+10 | Added placeholder sections (P5S3bT18)
*/

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export default function SettingsPage() {
  return (
    <div className="p-8 max-w-2xl">
      <h1 className="text-3xl font-bold mb-8">Settings</h1>

      <div className="space-y-6">
        {/* Auto-save Frequency Card */}
        <Card>
          <CardHeader>
            <CardTitle>Auto-save Frequency</CardTitle>
            <CardDescription>
              Configure how often drafts are auto-saved (Coming soon)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label htmlFor="autosave-delay">Delay (milliseconds)</Label>
              <Input
                id="autosave-delay"
                type="number"
                disabled
                placeholder="500 (default)"
                className="w-48"
              />
            </div>
          </CardContent>
        </Card>

        {/* Version Retention Card */}
        <Card>
          <CardHeader>
            <CardTitle>Version Retention</CardTitle>
            <CardDescription>
              Set how many versions to keep per document (Coming soon)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label htmlFor="version-limit">Maximum versions</Label>
              <Input
                id="version-limit"
                type="number"
                disabled
                placeholder="10 (default)"
                className="w-48"
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
