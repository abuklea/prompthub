# PromptHub
## P5S4c - Tabbed Editor Upgrade - INITIAL PLAN

| `Title` | `Created` | `Last modified` |
|---------|-----------|-----------------|
| P5S4c - Tabbed Editor Upgrade - INITIAL PLAN | 08/11/2025 12:52 GMT+10 | 08/11/2025 12:52 GMT+10 |

## Table of Contents
- [Executive Summary](#executive-summary)
- [Objectives](#objectives)
- [Implementation Approach](#implementation-approach)
- [Task Breakdown](#task-breakdown)
- [Technical Dependencies](#technical-dependencies)
- [Risk Assessment](#risk-assessment)
- [Success Metrics](#success-metrics)

## Executive Summary

This PRP transforms the Editor pane (column 3) from a single-document viewer into a VSCode-like tabbed-document container supporting multiple open documents simultaneously. The implementation includes tab drag-and-drop for reordering, keyboard shortcuts, and integration of all application pages (settings, profile, dashboard) as tabs within the editor pane.

**Key Features:**
- Multi-document tab support with drag-and-drop reordering
- VSCode-like keyboard shortcuts (Ctrl+W, Ctrl+Tab)
- Unified navigation for all app pages as tabs
- State persistence across browser sessions
- Auto-save per tab with localStorage backup
- Lazy-loaded editors for performance

**Phase 1 Scope:** Horizontal tab bar with basic tab management
**Deferred to Phase 2:** Split panes (horizontal/vertical)

## Objectives

1. **Multi-Document Support**: Open and manage multiple documents in tabs simultaneously
2. **VSCode-Like UX**: Drag-drop tab reordering, close buttons, keyboard shortcuts
3. **Unified Navigation**: All app pages (settings, profile, dashboard) open as tabs
4. **State Persistence**: Tab configuration persists across browser sessions
5. **Performance**: Lazy-load editors, efficient re-renders for 20+ tabs

## Implementation Approach

### Library Selection

**dnd-kit** chosen over flexlayout-react for:
- Lighter weight (~10kb vs 100kb+)
- TypeScript-native with first-class support
- Composability with existing shadcn/ui patterns
- Active development and React 18+ support
- Familiarity (used in shadcn sortable examples)

### Architecture Pattern

**Zustand Store + Component Composition:**
```typescript
useTabStore (global state)
  ↓
TabbedEditorContainer (keyboard shortcuts)
  ↓
├─ TabBar (dnd-kit sortable)
│  └─ DocumentTab[] (individual tabs)
└─ TabContent (lazy-loaded content)
   ├─ EditorPane (documents)
   ├─ SettingsPage
   ├─ ProfilePage
   └─ DashboardPage
```

### Data Model

**Tab Types:**
- `document` - Prompt/document with Monaco editor
- `settings` - Settings page
- `profile` - User profile page
- `dashboard` - Dashboard page
- `version-history` - Version history panel

**State Structure:**
```typescript
{
  tabs: TabData[]           // All open tabs
  activeTabId: string       // Currently focused tab
  layout: LayoutNode        // Simple panel (splits deferred)
}
```

### Migration Strategy

**Backwards Compatibility:**
- Check for existing `selectedPrompt` in `use-ui-store`
- Auto-migrate to tab on first load if present
- Clear old store after migration
- Graceful degradation if localStorage cleared

## Task Breakdown

### Phase 1: Core Tab Infrastructure (Tasks 1-6)

**T1: Install dependencies and create type definitions** [1-2 hours]
- Install @dnd-kit/core, @dnd-kit/sortable, @dnd-kit/utilities
- Create `src/features/tabs/types.ts` with TabType, TabData, LayoutNode interfaces
- Verify TypeScript compilation

**T2: Create Zustand tab store with persistence** [3-4 hours]
- Create `src/stores/use-tab-store.ts`
- Implement tab lifecycle actions (openTab, closeTab, setActiveTab, updateTab, reorderTabs)
- Add zustand persist middleware for localStorage
- Implement duplicate prevention logic
- Create selector hooks (useActiveTab, useTabById)

**T3: Build DocumentTab component with drag handle** [2-3 hours]
- Create `src/features/tabs/components/DocumentTab.tsx`
- Integrate dnd-kit useSortable hook
- Add dirty indicator (Circle icon)
- Add close button with tooltip
- Style active/inactive states

**T4: Build TabBar with dnd-kit sortable** [3-4 hours]
- Create `src/features/tabs/components/TabBar.tsx`
- Set up DndContext with sensors
- Implement SortableContext with horizontalListSortingStrategy
- Handle drag end events with arrayMove
- Add empty state UI

**T5: Create TabContent renderer component** [2-3 hours]
- Create `src/features/tabs/components/TabContent.tsx`
- Lazy load components (EditorPane, SettingsPage, etc.)
- Add Suspense with loading fallback
- Handle empty state (no active tab)

**T6: Build TabbedEditorContainer** [3-4 hours]
- Create `src/features/tabs/components/TabbedEditorContainer.tsx`
- Compose TabBar + TabContent
- Implement keyboard shortcuts (Ctrl+W, Ctrl+Tab, Ctrl+Shift+Tab)
- Add proper overflow handling

### Phase 2: Integration & Migration (Tasks 7-11)

**T7: Implement keyboard shortcuts** [1-2 hours]
- Ctrl+W closes active tab
- Ctrl+Tab switches to next tab
- Ctrl+Shift+Tab switches to previous tab
- Prevent default browser behavior

**T8: Refactor EditorPane as tab content** [2-3 hours]
- Accept promptId and tabId as props
- Update tab title when document title changes
- Update tab dirty state when content changes
- Preserve all auto-save and localStorage logic

**T9: Update PromptList to open tabs** [1-2 hours]
- Replace useUiStore.selectPrompt with useTabStore.openTab
- Pass document title and promptId to openTab
- Verify duplicate prevention (clicking same doc switches tab)

**T10: Update Header with settings/profile navigation** [1-2 hours]
- Add Settings button that opens settings tab
- Add Profile button that opens profile tab
- Use lucide-react Settings and User icons
- Add tooltips

**T11: Make settings/profile/dashboard tab-compatible** [1-2 hours]
- Verify pages work in lazy-loaded context
- Ensure no navigation conflicts
- Test single-instance constraint (only one settings tab)

### Phase 3: Final Integration (Tasks 12-14)

**T12: Replace EditorPane in layout with TabbedEditor** [1 hour]
- Update `src/app/(app)/layout.tsx`
- Replace EditorPane with TabbedEditorContainer
- Preserve PanelSubheader structure
- Verify panel resizing still works

**T13: Add migration logic for backwards compatibility** [2-3 hours]
- Implement migration from use-ui-store.selectedPrompt
- Fetch prompt details for migrated prompt
- Auto-open as tab on first load
- Clear old store after migration
- Add error handling for failed migrations

**T14: Split pane implementation** [4-6 hours] **DEFERRED TO PHASE 2**
- Implement splitPane action in store
- Create nested PanelGroup structure
- Handle layout tree updates
- Add split/unsplit UI controls
- **Note:** Marked as deferred - will not implement in this phase

## Technical Dependencies

### External Packages
- **@dnd-kit/core** - Drag and drop core (to be installed)
- **@dnd-kit/sortable** - Sortable preset (to be installed)
- **@dnd-kit/utilities** - Utility functions (to be installed)
- **zustand** - Already installed (v4.5.2)
- **react-resizable-panels** - Already installed (v3.0.6)

### Internal Dependencies
- `src/features/editor/components/EditorPane.tsx` - Current single-doc editor
- `src/stores/use-ui-store.ts` - Existing UI state (for migration)
- `src/features/editor/hooks/useAutoSave.ts` - Auto-save pattern
- `src/features/editor/hooks/useLocalStorage.ts` - localStorage pattern
- `src/components/layout/ResizablePanelsLayout.tsx` - Panel system

### Prerequisite PRPs
- **P5S4b** - COMPLETE (documented content bugs fixed)

## Risk Assessment

### High Confidence Areas ✅
- Tab state management (clear Zustand pattern from use-ui-store)
- dnd-kit integration (well-documented library with TS support)
- Component composition (follows existing layout patterns)
- Migration strategy (straightforward store migration)

### Medium Risk Areas ⚠️
- **Tab synchronization edge cases**
  - Mitigation: Clear update pattern, tab dirty state tracking
  - Test extensively: rapid tab switching, concurrent edits

- **Performance with many tabs**
  - Mitigation: Lazy loading, React.lazy for components
  - Test: 20+ tabs, measure switching latency

- **localStorage persistence edge cases**
  - Mitigation: Graceful degradation, migration logic
  - Test: Clear storage, corrupt data, quota exceeded

### Low Risk (Deferred) ⚠️
- **Split pane complexity**
  - Deferred to Phase 2 after basic tabs proven
  - Use react-resizable-panels (already working in layout)

## Success Metrics

### Functional Requirements
- [ ] Multiple documents open simultaneously in tabs
- [ ] Tab drag-and-drop reordering works smoothly
- [ ] Keyboard shortcuts function correctly (Ctrl+W, Ctrl+Tab)
- [ ] Settings/Profile/Dashboard accessible as tabs
- [ ] Tab state persists across browser sessions
- [ ] Auto-save works independently per tab
- [ ] Duplicate tab prevention (same doc opens existing tab)
- [ ] Empty state displays when no tabs open

### Performance Requirements
- [ ] Tab switching < 100ms
- [ ] Support 20+ tabs without lag
- [ ] Monaco editor lazy loads (not all instances at once)
- [ ] Build size increase < 50kb

### Code Quality Requirements
- [ ] TypeScript strict mode passes
- [ ] ESLint passes with no warnings
- [ ] All files have proper headers (per documentation.md)
- [ ] Follows existing codebase patterns
- [ ] No console errors or warnings

### User Experience Requirements
- [ ] Visual feedback during drag (opacity change)
- [ ] Dirty indicator shows unsaved changes
- [ ] Close button accessible and clear
- [ ] Tooltips provide helpful context
- [ ] Responsive design (mobile/desktop)

## Validation Commands

```bash
# TypeScript compilation
npx tsc --noEmit

# Linting
npm run lint

# Build verification
npm run build

# Development server
npm run dev
```

## Expected Outcomes

**Before Implementation:**
- Single-document editor pane
- Navigation to settings/profile via routing
- No tab management
- One document at a time

**After Implementation:**
- Multi-document tab bar with drag-drop
- All pages accessible as tabs
- VSCode-like keyboard shortcuts
- Persistent tab state
- Lazy-loaded content for performance

**Files Created:** (9 new files)
1. `src/features/tabs/types.ts`
2. `src/stores/use-tab-store.ts`
3. `src/features/tabs/components/DocumentTab.tsx`
4. `src/features/tabs/components/TabBar.tsx`
5. `src/features/tabs/components/TabContent.tsx`
6. `src/features/tabs/components/TabbedEditorContainer.tsx`
7. `package.json` (dependencies added)

**Files Modified:** (4 files)
1. `src/features/editor/components/EditorPane.tsx`
2. `src/features/prompts/components/PromptList.tsx`
3. `src/components/layout/Header.tsx`
4. `src/app/(app)/layout.tsx`

---

**Plan Status**: READY
**PRP Status**: TODO
**PRP ID**: P5S4c
**Archon Project**: PromptHub (d449f266-1f36-47ad-bd2d-30f1a0f5e999)
**PRP Document**: PRPs/P5S4c-tabbed-editor-upgrade.md
**Tasks**: 14 tasks (P5S4cT1 - P5S4cT14)
**Phase**: Phase 5 - Prompt Editor & Version Control
**Dependencies**: P5S4b (Complete)
**Implementation Status**: NOT YET STARTED (P5S4c)
**Testing Status**: NOT YET TESTED
**Next PRP**: P5S5 - Version History UI
**Documentation**:
- PRPs/P5S4c-tabbed-editor-upgrade.md
- docs/rules/documentation.md
- docs/rules/archon.md
**Recommendations:**
Agents:
- `senior-frontend-engineer` (Tasks 1-13)
- `ux-ui-designer` (Tasks 3-6 - tab UX design)
Notes:**
- Start with basic horizontal tab bar (no splits)
- Defer split panes (T14) to Phase 2 after basic tabs working
- Preserve all existing auto-save and localStorage patterns
- Follow compact UI sizing (12px base, 36px subheader)
- Use dnd-kit (lightweight, TypeScript-first)
- Execute in batches: T1-3, T4-6, T7-9, T10-13
**Estimated Implementation Time (FTE):** 25-35 hours (3-5 days)
