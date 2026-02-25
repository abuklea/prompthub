"use client"

import { useEffect, useMemo, useState, useTransition } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2 } from "lucide-react"

type AppSettings = {
  autosaveDelayMs: number
  compactDensity: boolean
  reduceMotion: boolean
  preloadWorkspaceOnLaunch: boolean
}

const DEFAULT_SETTINGS: AppSettings = {
  autosaveDelayMs: 500,
  compactDensity: false,
  reduceMotion: false,
  preloadWorkspaceOnLaunch: true,
}

const STORAGE_KEY = "prompthub:user-settings:v1"

export default function SettingsPage() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS)
  const [isSaving, startTransition] = useTransition()
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as AppSettings
        setSettings({ ...DEFAULT_SETTINGS, ...parsed })
      } catch {
        localStorage.removeItem(STORAGE_KEY)
      }
    }
    setHydrated(true)
  }, [])

  const updateSetting = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    const next = { ...settings, [key]: value }
    setSettings(next)

    startTransition(() => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    })
  }

  const saveStateText = useMemo(() => {
    if (!hydrated) return "Loading settings..."
    return isSaving ? "Syncing settings..." : "Settings saved locally"
  }, [hydrated, isSaving])

  return (
    <div className="mx-auto w-full max-w-4xl p-6 sm:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Settings</h1>
        <div className="text-xs text-muted-foreground flex items-center gap-2">
          {isSaving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {saveStateText}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Editing Experience</CardTitle>
          <CardDescription>Core writing preferences that directly affect speed and comfort.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="autosave-delay">Auto-save delay (ms)</Label>
            <Input
              id="autosave-delay"
              type="number"
              min={200}
              max={5000}
              value={settings.autosaveDelayMs}
              onChange={(e) => updateSetting("autosaveDelayMs", Number(e.target.value || 500))}
              className="max-w-xs"
            />
          </div>

          <label className="flex items-center justify-between rounded-md border p-3 cursor-pointer">
            <span className="text-sm">Use compact panel density</span>
            <input
              type="checkbox"
              checked={settings.compactDensity}
              onChange={(e) => updateSetting("compactDensity", e.target.checked)}
            />
          </label>

          <label className="flex items-center justify-between rounded-md border p-3 cursor-pointer">
            <span className="text-sm">Reduce motion effects</span>
            <input
              type="checkbox"
              checked={settings.reduceMotion}
              onChange={(e) => updateSetting("reduceMotion", e.target.checked)}
            />
          </label>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Data & Sync</CardTitle>
          <CardDescription>Control preload and cache behavior for near-instant document browsing.</CardDescription>
        </CardHeader>
        <CardContent>
          <label className="flex items-center justify-between rounded-md border p-3 cursor-pointer">
            <span className="text-sm">Preload full workspace snapshot on launch</span>
            <input
              type="checkbox"
              checked={settings.preloadWorkspaceOnLaunch}
              onChange={(e) => updateSetting("preloadWorkspaceOnLaunch", e.target.checked)}
            />
          </label>
        </CardContent>
      </Card>
    </div>
  )
}
