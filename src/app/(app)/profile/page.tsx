"use client"

import { useEffect, useState } from "react"
import { Loader2, Save } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { getProfile, updateProfileDisplayName } from "@/features/profile/actions"

export default function ProfilePage() {
  const [displayName, setDisplayName] = useState("")
  const [email, setEmail] = useState("")
  const [createdAt, setCreatedAt] = useState<Date | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    async function load() {
      try {
        const profile = await getProfile()
        setDisplayName(profile.displayName)
        setEmail(profile.email)
        setCreatedAt(new Date(profile.createdAt))
      } catch (error) {
        console.error("Failed to load profile", error)
        toast.error("Could not load profile")
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [])

  const handleSave = async () => {
    const optimisticName = displayName
    setSaving(true)

    try {
      const updated = await updateProfileDisplayName(optimisticName)
      setDisplayName(updated.displayName)
      toast.success("Profile updated")
    } catch (error) {
      console.error("Failed to save profile", error)
      toast.error("Could not update profile")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-semibold">Profile</h1>
        <p className="text-sm text-muted-foreground">Manage your account identity details.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Account details</CardTitle>
          <CardDescription>Profile updates are applied instantly and synced to your account.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="displayName">Display name</Label>
            <Input
              id="displayName"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              disabled={loading}
              placeholder="How your name appears in the app"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" value={email} disabled />
          </div>

          <div className="rounded-md border p-3 text-xs text-muted-foreground">
            Member since: {createdAt ? createdAt.toLocaleDateString() : "-"}
          </div>

          <Button onClick={handleSave} disabled={loading || saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save profile
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
