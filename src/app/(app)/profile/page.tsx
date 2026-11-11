/*
Project: PromptHub
Author: Allan James
Source: src/app/(app)/profile/page.tsx
MIME: text/typescript
Type: TypeScript React Component

Created: 06/11/2025 14:28 GMT+10
Last modified: 29/10/2026 20:59 GMT+10
---------------
The account page: shows the signed-in user's email and join date and lets them change their display name. Loads the
details with getProfileDetails and saves with updateDisplayName; a failed result is shown as a toast.

Changelog:
29/10/2026 20:59 GMT+10 | P7S2T8: both actions return ActionResult; the page branches on success, shows result.error
                         on failure and sends { displayName }; header added
06/11/2025 14:28 GMT+10 | Created (commit 010f7d1)
*/

"use client"

import { useEffect, useState, useTransition } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Loader2 } from "lucide-react"
import { getProfileDetails, updateDisplayName } from "@/features/profile/actions"
import { toast } from "sonner"

export default function ProfilePage() {
  const [email, setEmail] = useState("")
  const [displayName, setDisplayName] = useState("")
  const [joined, setJoined] = useState("")
  const [loading, setLoading] = useState(true)
  const [saving, startTransition] = useTransition()

  useEffect(() => {
    async function loadProfile() {
      try {
        const result = await getProfileDetails()
        if (!result.success) {
          toast.error(result.error)
          return
        }

        const profile = result.data
        setEmail(profile.email)
        setDisplayName(profile.displayName)
        setJoined(new Date(profile.createdAt).toLocaleDateString())
      } catch (error) {
        console.error("Failed to load profile", error)
        toast.error("Could not load profile details")
      } finally {
        setLoading(false)
      }
    }

    loadProfile()
  }, [])

  const onSave = () => {
    const optimisticValue = displayName
    startTransition(async () => {
      try {
        const result = await updateDisplayName({ displayName: optimisticValue })
        if (!result.success) {
          toast.error(result.error)
          return
        }

        setDisplayName(result.data.displayName)
        toast.success("Profile updated")
      } catch (error) {
        console.error("Failed to save profile", error)
        toast.error("Failed to update profile")
      }
    })
  }

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-4xl p-6 sm:p-8 text-muted-foreground flex items-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading profile...
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-4xl p-6 sm:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Profile</h1>
        <div className="text-xs text-muted-foreground flex items-center gap-2">
          {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {saving ? "Saving profile..." : "Profile up to date"}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
          <CardDescription>Manage your identity details used across PromptHub.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="profile-email">Email</Label>
            <Input id="profile-email" value={email} disabled />
          </div>

          <div className="space-y-2">
            <Label htmlFor="display-name">Display name</Label>
            <Input
              id="display-name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your preferred name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="joined-date">Joined</Label>
            <Input id="joined-date" value={joined} disabled />
          </div>

          <div className="flex justify-end">
            <Button onClick={onSave} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save profile
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
