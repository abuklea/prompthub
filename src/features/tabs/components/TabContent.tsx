/*
Project: PromptHub
Author: Allan James
Source: src/features/tabs/components/TabContent.tsx
MIME: text/typescript
Type: TypeScript React Component

Created: 08/11/2025 13:01 GMT+10
Last modified: 08/11/2025 15:19 GMT+10
---------------
Content renderer that switches between different tab types.
Lazy loads components for performance (EditorPane, SettingsPage, etc).

Changelog:
08/11/2025 15:19 GMT+10 | Wrapped console.log with development-only guard (P5S4T5)
08/11/2025 13:01 GMT+10 | Initial creation - Tab content renderer
*/

"use client"

import { lazy, Suspense } from 'react'
import { useActiveTab } from '@/stores/use-tab-store'

// Lazy load components for performance
const EditorPane = lazy(() => import('@/features/editor/components/EditorPane').then(mod => ({ default: mod.EditorPane })))
const SettingsPage = lazy(() => import('@/app/(app)/settings/page'))
const DashboardPage = lazy(() => import('@/app/(app)/dashboard/page'))
const ProfilePage = lazy(() => import('@/app/(app)/profile/page'))

var lastTabId: string | null = null;

export function TabContent() {
  const activeTab = useActiveTab()

  if (lastTabId !== activeTab?.id && process.env.NODE_ENV === 'development') {
    lastTabId = activeTab?.id || null;
    console.log('[TabContent] Active tab:', activeTab?.id, 'type:', activeTab?.type, 'promptId:', activeTab?.promptId)
  }

  if (!activeTab) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">
          Select a document or open a page to begin
        </p>
      </div>
    )
  }

  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-full">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      }
    >
      {activeTab.type === 'document' && (
        <EditorPane promptId={activeTab.promptId!} tabId={activeTab.id} />
      )}
      {activeTab.type === 'settings' && <SettingsPage />}
      {activeTab.type === 'dashboard' && <DashboardPage />}
      {activeTab.type === 'profile' && <ProfilePage />}
      {activeTab.type === 'version-history' && (
        <div className="p-8">
          <h1 className="text-2xl font-bold">Version History</h1>
          <p className="text-muted-foreground">Coming soon</p>
        </div>
      )}
    </Suspense>
  )
}
