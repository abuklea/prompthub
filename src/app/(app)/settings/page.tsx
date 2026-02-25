"use client"

import { useEffect, useMemo, useState } from "react"
import { Loader2, RefreshCw } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"

interface UserSettings {
  compactMode: boolean
  autoOpenLastTab: boolean
  showSyncBadge: boolean
}

const STORAGE_KEY = "prompthub-user-settings"

const defaultSettings: UserSettings = {
  compactMode: false,
  autoOpenLastTab: true,
  showSyncBadge: true,
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<UserSettings>(defaultSettings)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as UserSettings
        setSettings({ ...defaultSettings, ...parsed })
      }
    } catch (error) {
      console.error("Failed to read settings", error)
    } finally {
      setLoading(false)
    }
  }, [])

  const saveSettings = async (next: UserSettings) => {
    setSettings(next)
    setSyncing(true)

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      await new Promise((resolve) => setTimeout(resolve, 180))
      toast.success("Settings updated")
    } catch (error) {
      console.error("Failed to save settings", error)
      toast.error("Could not save settings")
    } finally {
      setSyncing(false)
    }
  }

  const statusText = useMemo(() => {
    if (loading) return "Loading settings..."
    return syncing ? "Saving changes..." : "Changes are saved instantly"
  }, [loading, syncing])

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 p-4 md:p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Settings</h1>
          <p className="text-sm text-muted-foreground">Critical controls for fast editing and predictable workspace behavior.</p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-md border px-2 py-1 text-xs text-muted-foreground">
          {syncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          {statusText}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Workspace behavior</CardTitle>
          <CardDescription>These settings are applied optimistically and stored locally for immediate effect.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-3 rounded-md border p-3">
            <div>
              <Label className="text-sm">Compact pane mode</Label>
              <p className="text-xs text-muted-foreground">Use denser spacing to show more folders and documents.</p>
            </div>
            <Button variant="outline" size="sm" disabled={loading} onClick={() => saveSettings({ ...settings, compactMode: !settings.compactMode })}>{settings.compactMode ? "On" : "Off"}</Button>
          </div>

          <div className="flex items-center justify-between gap-3 rounded-md border p-3">
            <div>
              <Label className="text-sm">Auto-open last active tab</Label>
              <p className="text-xs text-muted-foreground">Reopen your previous editor tab after reload.</p>
            </div>
            <Button variant="outline" size="sm" disabled={loading} onClick={() => saveSettings({ ...settings, autoOpenLastTab: !settings.autoOpenLastTab })}>{settings.autoOpenLastTab ? "On" : "Off"}</Button>
          </div>

          <div className="flex items-center justify-between gap-3 rounded-md border p-3">
            <div>
              <Label className="text-sm">Show sync indicators</Label>
              <p className="text-xs text-muted-foreground">Keep visible progress indicators for background sync and saves.</p>
            </div>
            <Button variant="outline" size="sm" disabled={loading} onClick={() => saveSettings({ ...settings, showSyncBadge: !settings.showSyncBadge })}>{settings.showSyncBadge ? "On" : "Off"}</Button>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button variant="outline" onClick={() => saveSettings(defaultSettings)} disabled={loading || syncing}>
          Reset defaults
        </Button>
      </div>
    </div>
  )
}
