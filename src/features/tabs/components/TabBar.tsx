/*
Project: PromptHub
Author: Allan James
Source: src/features/tabs/components/TabBar.tsx
MIME: text/typescript
Type: TypeScript React Component

Created: 08/11/2025 13:00 GMT+10
Last modified: 08/11/2025 13:00 GMT+10
---------------
Tab bar container with dnd-kit sortable context for drag-and-drop reordering.
Renders all open tabs in a horizontal scrollable bar with drag-drop support.

Changelog:
08/11/2025 13:00 GMT+10 | Initial creation - Tab bar with drag-drop
*/

"use client"

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  horizontalListSortingStrategy,
} from '@dnd-kit/sortable'
import { TooltipProvider } from '@/components/ui/tooltip'
import { DocumentTab } from './DocumentTab'
import { useTabStore } from '@/stores/use-tab-store'

export function TabBar() {
  const { tabs, activeTabId, setActiveTab, closeTab, reorderTabs } = useTabStore()

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event

    if (over && active.id !== over.id) {
      const oldIndex = tabs.findIndex(t => t.id === active.id)
      const newIndex = tabs.findIndex(t => t.id === over.id)

      const reordered = arrayMove(tabs, oldIndex, newIndex)
      reorderTabs(reordered.map(t => t.id))
    }
  }

  if (tabs.length === 0) {
    return (
      <div className="flex items-center h-9 px-4 border-b text-sm text-muted-foreground">
        No tabs open
      </div>
    )
  }

  return (
    <div className="flex items-center h-9 border-b overflow-x-auto scrollbar-thin">
      <TooltipProvider>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={tabs.map(t => t.id)}
            strategy={horizontalListSortingStrategy}
          >
            {tabs.map(tab => (
              <DocumentTab
                key={tab.id}
                tab={tab}
                isActive={tab.id === activeTabId}
                onClose={() => closeTab(tab.id)}
                onClick={() => setActiveTab(tab.id)}
              />
            ))}
          </SortableContext>
        </DndContext>
      </TooltipProvider>
    </div>
  )
}
