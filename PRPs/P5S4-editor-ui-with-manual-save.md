# PromptHub
## P5S4 - Editor UI with Manual Save

| `Title` | `Created` | `Last modified` |
|---------|-----------|-----------------|
| P5S4 - Editor UI with Manual Save | 07/11/2025 20:19 GMT+10 | 07/11/2025 20:19 GMT+10 |

## Table of Contents
- [Overview](#overview)
- [Current Implementation Status](#current-implementation-status)
- [Remaining Work](#remaining-work)
- [Markdown Editor Actions Specification](#markdown-editor-actions-specification)
- [Implementation Blueprint](#implementation-blueprint)
- [Task Breakdown](#task-breakdown)
- [Validation Gates](#validation-gates)
- [References](#references)

## Overview

**Phase 5, Step 4** completes the editor implementation by adding markdown-optimized editing features to the Monaco Editor. The majority of P5S4's functionality was already implemented during P5S3b (Improved UI Update) and P5S3d (Compact UI fixes), including:

- ✅ Manual save workflow with Ctrl+S keyboard shortcut
- ✅ Auto-save with 500ms debounce
- ✅ Version creation via saveNewVersion server action
- ✅ Loading states (saving, auto-saving indicators)
- ✅ Success/error feedback via toast notifications
- ✅ localStorage persistence for unsaved changes
- ✅ Full-height Monaco editor (fixed in P5S3d)

**This PRP focuses on the remaining work**:
1. Reduce Monaco editor font size from 14px to 13px (per implementation plan)
2. Add markdown-specific editor actions and keyboard shortcuts
3. Provide text editing tools optimized for markdown format (headers, tables, lists, etc.)

**Status**: ~85% complete. Only frontend editor enhancements needed.

## Current Implementation Status

### ✅ Already Implemented (P5S3b, P5S3d)

#### EditorPane Component (`src/features/editor/components/EditorPane.tsx`)
**Complete implementation with**:
- Prompt loading via `getPromptDetails` server action
- Title and content state management
- Auto-save hook integration with 500ms debounce
- Manual save via `handleSave` callback (invokes `saveNewVersion`)
- Ctrl+S keyboard shortcut listener
- localStorage sync for unsaved changes
- Loading states: `loading`, `saving`, `autoSaving`
- Last saved timestamp tracking
- Toast notifications for success/error feedback
- Empty state, loading state, and error state UI

**Code Reference** (existing pattern):
```typescript
// src/features/editor/components/EditorPane.tsx (lines 43-206)

// Auto-save with debounce (P5S3bT14)
const handleAutoSave = useCallback(async (promptId: string, content: string) => {
  setAutoSaving(true)
  const result = await autoSavePrompt({ promptId, content })
  if (result.success) {
    setLastSaved(new Date())
  }
  setAutoSaving(false)
}, [])

useAutoSave({
  content,
  promptId: selectedPrompt,
  delay: 500,
  onSave: handleAutoSave
})

// Manual save with version creation (P5S3bT14)
const handleSave = useCallback(async () => {
  if (!selectedPrompt) return

  setSaving(true)
  const result = await saveNewVersion({
    promptId: selectedPrompt,
    newTitle: title,
    newContent: content,
  })

  if (result.success) {
    toast.success("Version saved successfully")
    clearLocalContent()
    setLastSaved(new Date())
  } else {
    toast.error(result.error, { duration: 6000 })
  }
  setSaving(false)
}, [selectedPrompt, title, content, clearLocalContent])

// Keyboard shortcut for Ctrl+S
useEffect(() => {
  function handleKeyDown(e: KeyboardEvent) {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault()
      handleSave()
    }
  }
  window.addEventListener('keydown', handleKeyDown)
  return () => window.removeEventListener('keydown', handleKeyDown)
}, [handleSave])
```

#### Editor Component (`src/features/editor/components/Editor.tsx`)
**Complete implementation with**:
- SSR-safe dynamic import with `ssr: false`
- Custom "boldSimplicity" theme matching design system
- Full-height rendering (fixed in P5S3d)
- Font size: **14px** (needs reduction to 13px per plan)
- Font family: var(--font-geist-mono, monospace)
- Line height: 1.6
- Features enabled:
  - Context menu (right-click)
  - Find/replace functionality
  - IntelliSense suggestions
  - Smooth scrolling and cursor animation
  - Automatic layout adjustment

**Code Reference** (existing pattern):
```typescript
// src/features/editor/components/Editor.tsx (lines 52-150)

function handleMount(editor: any, monaco: any) {
  editorRef.current = editor

  // Configure editor options with sensible defaults
  editor.updateOptions({
    fontSize: 14,  // TODO P5S4T1: Change to 13
    fontFamily: 'var(--font-geist-mono, monospace)',
    lineHeight: 1.6,
    padding: { top: 16, bottom: 16 },
    scrollBeyondLastLine: false,
    minimap: { enabled: false },
    renderLineHighlight: 'line',
    smoothScrolling: true,
    cursorBlinking: 'smooth',
    cursorSmoothCaretAnimation: 'on',
    ...options
  })

  if (onMount) {
    onMount(editor, monaco)
  }
}
```

#### Server Actions (`src/features/editor/actions.ts`)
**Complete implementation with**:
- `saveNewVersion`: Creates PromptVersion with Git-style diff, updates Prompt (atomic transaction)
- `autoSavePrompt`: Updates content only, no version creation (silent background save)
- User isolation enforcement (user_id filters)
- Zod validation via schemas
- Error object pattern (never throws exceptions)
- NEXT_REDIRECT handling

**Code Reference**:
```typescript
// src/features/editor/actions.ts (lines 37-106)

export async function saveNewVersion(
  data: unknown
): Promise<ActionResult<{ versionId: number }>> {
  // Step 1-3: Validate, authenticate, fetch current prompt
  // Step 4: Calculate Git-style patch using diff-utils
  const diff = createPatch(currentPrompt.content, newContent)

  // Step 5: Atomic transaction (version + prompt update)
  const result = await db.$transaction(async (tx) => {
    const promptVersion = await tx.promptVersion.create({
      data: { prompt_id: promptId, diff: diff }
    })
    await tx.prompt.update({
      where: { id: promptId },
      data: { title: newTitle, content: newContent, updated_at: new Date() }
    })
    return promptVersion
  })

  return { success: true, data: { versionId: result.id } }
}
```

#### Hooks (`src/features/editor/hooks/useAutoSave.ts`)
**Complete implementation with**:
- Debounced auto-save with configurable delay (default 500ms)
- Cleanup on unmount to prevent memory leaks
- Skip logic when no prompt selected

### ⏳ Remaining Work (This PRP)

1. **Font Size Reduction**: Change Monaco editor font from 14px to 13px
2. **Markdown Editor Actions**: Add 10 markdown-specific actions with keyboard shortcuts:
   - Bold (Ctrl+B)
   - Italic (Ctrl+I)
   - Headings 1-3 (Ctrl+1, Ctrl+2, Ctrl+3)
   - Code Inline (Ctrl+`)
   - Code Block (Ctrl+Shift+C)
   - Bullet List (Ctrl+Shift+8)
   - Numbered List (Ctrl+Shift+7)
   - Insert Link (Ctrl+K)
   - Insert Table (context menu only)
   - Blockquote (Ctrl+Shift+.)

## Markdown Editor Actions Specification

### Design Philosophy
- **Toggle Behavior**: Actions like bold, lists, headings should toggle (remove formatting if already applied)
- **Smart Defaults**: When no text is selected, insert placeholder text with cursor positioned for immediate typing
- **Context Menu Integration**: All actions available via right-click menu under "Markdown" group
- **Keyboard-First**: Common operations have VSCode-style keyboard shortcuts
- **Multi-Line Support**: List and blockquote actions work across multiple selected lines

### Action Specifications

#### 1. Bold (Ctrl+B / Cmd+B)
**Behavior**:
- Selection exists: Wrap in `**text**`
- No selection: Insert `**bold**` with cursor between asterisks
- Already bold: Remove `**` markers (toggle)

**Implementation Pattern**:
```typescript
{
  id: 'markdown.bold',
  label: 'Bold',
  keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyB],
  contextMenuGroupId: 'markdown',
  contextMenuOrder: 1,
  run: (editor) => {
    const selection = editor.getSelection()
    const model = editor.getModel()
    const text = model?.getValueInRange(selection) || ''

    // Toggle: remove if already bold
    if (text.startsWith('**') && text.endsWith('**')) {
      const unwrapped = text.slice(2, -2)
      editor.executeEdits('', [{ range: selection, text: unwrapped }])
    } else if (text) {
      editor.executeEdits('', [{ range: selection, text: `**${text}**` }])
    } else {
      // No selection: insert placeholder
      editor.executeEdits('', [{
        range: selection,
        text: '**bold**',
        forceMoveMarkers: true
      }])
      // Move cursor inside asterisks
      const pos = selection.getStartPosition()
      editor.setPosition({ lineNumber: pos.lineNumber, column: pos.column + 2 })
    }
  }
}
```

#### 2. Italic (Ctrl+I / Cmd+I)
**Behavior**:
- Selection exists: Wrap in `*text*`
- No selection: Insert `*italic*` with cursor between asterisks
- Already italic: Remove `*` markers (toggle)

#### 3. Headings (Ctrl+1, Ctrl+2, Ctrl+3)
**Behavior**:
- Prepend `#`, `##`, or `###` to start of line
- If line already starts with heading markers of same level: remove (toggle)
- If line starts with different heading level: replace with new level
- Works on current line regardless of selection

**Implementation Pattern**:
```typescript
{
  id: 'markdown.heading1',
  label: 'Heading 1',
  keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.Digit1],
  contextMenuGroupId: 'markdown',
  run: (editor) => {
    const position = editor.getPosition()
    const model = editor.getModel()
    const lineContent = model.getLineContent(position.lineNumber)

    // Toggle or replace heading
    let newContent = lineContent
    if (lineContent.startsWith('# ')) {
      newContent = lineContent.slice(2) // Remove H1
    } else if (lineContent.match(/^#{1,6} /)) {
      newContent = '# ' + lineContent.replace(/^#{1,6} /, '') // Replace with H1
    } else {
      newContent = '# ' + lineContent // Add H1
    }

    editor.executeEdits('', [{
      range: {
        startLineNumber: position.lineNumber,
        startColumn: 1,
        endLineNumber: position.lineNumber,
        endColumn: lineContent.length + 1
      },
      text: newContent
    }])
  }
}
```

#### 4. Code Inline (Ctrl+`)
**Behavior**:
- Selection exists: Wrap in `` `text` ``
- No selection: Insert `` `code` `` with cursor inside
- Already wrapped in backticks: Remove (toggle)

#### 5. Code Block (Ctrl+Shift+C)
**Behavior**:
- Selection exists: Wrap in triple backticks with newlines
- No selection: Insert template with cursor on language line
- Format: ` ```\ncode\n``` `

**Implementation Pattern**:
```typescript
{
  id: 'markdown.codeBlock',
  label: 'Code Block',
  keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyC],
  contextMenuGroupId: 'markdown',
  run: (editor) => {
    const selection = editor.getSelection()
    const text = editor.getModel()?.getValueInRange(selection) || ''

    if (text) {
      const wrapped = `\`\`\`\n${text}\n\`\`\``
      editor.executeEdits('', [{ range: selection, text: wrapped }])
    } else {
      const template = '```\ncode\n```'
      editor.executeEdits('', [{ range: selection, text: template }])
      // Position cursor after opening backticks
      const pos = selection.getStartPosition()
      editor.setPosition({
        lineNumber: pos.lineNumber,
        column: pos.column + 3
      })
    }
  }
}
```

#### 6. Bullet List (Ctrl+Shift+8)
**Behavior**:
- Single line selected: Prepend `- ` to line
- Multiple lines selected: Prepend `- ` to each line
- Already bulleted: Remove `- ` prefix (toggle)
- Multi-line aware: Each line treated independently

**Implementation Pattern**:
```typescript
{
  id: 'markdown.bulletList',
  label: 'Bullet List',
  keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.Digit8],
  contextMenuGroupId: 'markdown',
  run: (editor) => {
    const selection = editor.getSelection()
    const model = editor.getModel()
    const startLine = selection.startLineNumber
    const endLine = selection.endLineNumber

    const edits = []
    for (let lineNum = startLine; lineNum <= endLine; lineNum++) {
      const lineContent = model.getLineContent(lineNum)
      let newContent = lineContent

      if (lineContent.startsWith('- ')) {
        newContent = lineContent.slice(2) // Remove bullet
      } else if (lineContent.match(/^\d+\. /)) {
        newContent = '- ' + lineContent.replace(/^\d+\. /, '') // Replace numbered with bullet
      } else {
        newContent = '- ' + lineContent // Add bullet
      }

      edits.push({
        range: {
          startLineNumber: lineNum,
          startColumn: 1,
          endLineNumber: lineNum,
          endColumn: lineContent.length + 1
        },
        text: newContent
      })
    }

    editor.executeEdits('', edits)
  }
}
```

#### 7. Numbered List (Ctrl+Shift+7)
**Behavior**:
- Single line: Prepend `1. `
- Multiple lines: Prepend `1. `, `2. `, `3. `, etc. sequentially
- Already numbered: Remove numbering (toggle)

#### 8. Insert Link (Ctrl+K / Cmd+K)
**Behavior**:
- Selection exists: Use as link text → `[selection](url)`
- No selection: Insert template → `[text](url)`
- Cursor positioned at `url` for immediate typing

**Implementation Pattern**:
```typescript
{
  id: 'markdown.insertLink',
  label: 'Insert Link',
  keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyK],
  contextMenuGroupId: 'markdown',
  run: (editor) => {
    const selection = editor.getSelection()
    const text = editor.getModel()?.getValueInRange(selection) || 'text'
    const linkTemplate = `[${text}](url)`

    editor.executeEdits('', [{ range: selection, text: linkTemplate }])

    // Position cursor at 'url' for immediate typing
    const pos = selection.getStartPosition()
    const urlStart = pos.column + text.length + 3 // After ']('
    editor.setSelection({
      startLineNumber: pos.lineNumber,
      startColumn: urlStart,
      endLineNumber: pos.lineNumber,
      endColumn: urlStart + 3 // Select 'url'
    })
  }
}
```

#### 9. Insert Table
**Behavior**:
- Always inserts 3x3 markdown table template
- No keyboard shortcut (context menu only)
- Cursor positioned in first header cell

**Template**:
```markdown
| Header 1 | Header 2 | Header 3 |
|----------|----------|----------|
| Cell 1   | Cell 2   | Cell 3   |
| Cell 4   | Cell 5   | Cell 6   |
```

#### 10. Blockquote (Ctrl+Shift+.)
**Behavior**:
- Single line: Prepend `> `
- Multiple lines: Prepend `> ` to each line
- Already quoted: Remove `> ` prefix (toggle)

## Implementation Blueprint

### File Structure

```
src/features/editor/
├── components/
│   ├── Editor.tsx           # MODIFY: Integrate markdown actions, reduce font to 13px
│   └── EditorPane.tsx       # NO CHANGES (already complete)
├── hooks/
│   └── useAutoSave.ts       # NO CHANGES (already complete)
├── actions.ts               # NO CHANGES (already complete)
├── schemas.ts               # NO CHANGES (already complete)
└── markdown-actions.ts      # CREATE: Markdown action definitions
```

### New File: `src/features/editor/markdown-actions.ts`

**Purpose**: Centralized markdown action definitions with helper utilities

**Exports**:
```typescript
export interface MarkdownAction {
  id: string
  label: string
  keybindings?: number[]
  contextMenuGroupId: string
  contextMenuOrder?: number
  run: (editor: any) => void
}

// Helper functions
export function wrapSelection(
  editor: any,
  prefix: string,
  suffix: string
): void

export function toggleLinePrefix(
  editor: any,
  prefix: string
): void

export function insertTemplate(
  editor: any,
  template: string,
  cursorOffset?: number
): void

// Action definitions
export const markdownActions: MarkdownAction[]
```

**Implementation Strategy**:
1. Create helper functions for common patterns (wrap, toggle, insert)
2. Define all 10 actions using helpers
3. Export as array for easy iteration in Editor.tsx
4. Use TypeScript for type safety (editor types from monaco-editor)

### Modified File: `src/features/editor/components/Editor.tsx`

**Changes Required**:

1. **Import markdown actions** (line ~20):
```typescript
import { markdownActions } from '../markdown-actions'
```

2. **Reduce font size** (line ~67):
```typescript
editor.updateOptions({
  fontSize: 13,  // Changed from 14 (P5S4T1)
  // ... rest unchanged
})
```

3. **Register actions in handleMount** (line ~75, after updateOptions):
```typescript
// Register markdown editor actions (P5S4T2-T4)
markdownActions.forEach(action => {
  editor.addAction({
    id: action.id,
    label: action.label,
    keybindings: action.keybindings,
    contextMenuGroupId: action.contextMenuGroupId,
    contextMenuOrder: action.contextMenuOrder,
    run: () => action.run(editor)
  })
})
```

## Task Breakdown

### Task 1: Reduce Monaco Editor Font Size (5 min)
**File**: `src/features/editor/components/Editor.tsx`

**Changes**:
```typescript
// Line 67 (in handleMount function)
editor.updateOptions({
  fontSize: 13,  // Changed from 14
  // ... rest unchanged
})
```

**Verification**:
1. Start dev server: `npm run dev`
2. Navigate to dashboard: http://localhost:3010/dashboard
3. Open a prompt in editor
4. Verify text is readable at 13px
5. Compare to previous 14px (should be slightly smaller but still comfortable)

**Success Criteria**:
- ✅ Editor font renders at 13px
- ✅ Text is readable and comfortable for editing
- ✅ Line height and spacing remain balanced

---

### Task 2: Create Markdown Actions Utility (45 min)
**File**: `src/features/editor/markdown-actions.ts` (CREATE)

**Implementation**:

```typescript
/*
Project: PromptHub
Author: Allan James
Source: src/features/editor/markdown-actions.ts
MIME: text/typescript
Type: TypeScript

Created: 07/11/2025 20:30 GMT+10
Last modified: 07/11/2025 20:30 GMT+10
---------------
Markdown editor action definitions for Monaco Editor.
Provides keyboard shortcuts and context menu actions for common markdown operations.

Changelog:
07/11/2025 20:30 GMT+10 | Initial creation with 10 markdown actions
*/

import type monaco from 'monaco-editor'

export interface MarkdownAction {
  id: string
  label: string
  keybindings?: number[]
  contextMenuGroupId: string
  contextMenuOrder?: number
  run: (editor: any) => void
}

/**
 * Helper: Wrap selected text with prefix and suffix
 * If no selection, insert placeholder with cursor positioned inside
 */
function wrapSelection(
  editor: any,
  prefix: string,
  suffix: string,
  placeholder: string = 'text'
): void {
  const selection = editor.getSelection()
  const model = editor.getModel()
  const text = model?.getValueInRange(selection) || ''

  if (text) {
    // Wrap existing text
    editor.executeEdits('', [{
      range: selection,
      text: `${prefix}${text}${suffix}`
    }])
  } else {
    // Insert placeholder
    editor.executeEdits('', [{
      range: selection,
      text: `${prefix}${placeholder}${suffix}`,
      forceMoveMarkers: true
    }])
    // Position cursor inside wrapper
    const pos = selection.getStartPosition()
    editor.setPosition({
      lineNumber: pos.lineNumber,
      column: pos.column + prefix.length
    })
  }
}

/**
 * Helper: Toggle line prefix (for lists, blockquotes, headings)
 * Works across multiple selected lines
 */
function toggleLinePrefix(
  editor: any,
  prefix: string,
  replace: boolean = false
): void {
  const selection = editor.getSelection()
  const model = editor.getModel()
  const startLine = selection.startLineNumber
  const endLine = selection.endLineNumber

  const edits = []
  for (let lineNum = startLine; lineNum <= endLine; lineNum++) {
    const lineContent = model.getLineContent(lineNum)
    let newContent = lineContent

    if (lineContent.startsWith(prefix)) {
      // Remove prefix (toggle off)
      newContent = lineContent.slice(prefix.length)
    } else if (replace && lineContent.match(/^([-*]|\d+\.)\s/)) {
      // Replace existing list marker
      newContent = prefix + lineContent.replace(/^([-*]|\d+\.)\s/, '')
    } else {
      // Add prefix
      newContent = prefix + lineContent
    }

    edits.push({
      range: {
        startLineNumber: lineNum,
        startColumn: 1,
        endLineNumber: lineNum,
        endColumn: lineContent.length + 1
      },
      text: newContent
    })
  }

  editor.executeEdits('', edits)
}

/**
 * Helper: Insert template at cursor position
 */
function insertTemplate(
  editor: any,
  template: string,
  cursorOffset: number = 0
): void {
  const selection = editor.getSelection()
  editor.executeEdits('', [{
    range: selection,
    text: template
  }])

  if (cursorOffset !== 0) {
    const pos = selection.getStartPosition()
    editor.setPosition({
      lineNumber: pos.lineNumber,
      column: pos.column + cursorOffset
    })
  }
}

// Define all markdown actions
export const markdownActions: MarkdownAction[] = [
  // 1. Bold
  {
    id: 'markdown.bold',
    label: 'Bold',
    keybindings: [2048 | 32], // Ctrl+B (KeyMod.CtrlCmd | KeyCode.KeyB)
    contextMenuGroupId: 'markdown',
    contextMenuOrder: 1,
    run: (editor) => wrapSelection(editor, '**', '**', 'bold')
  },

  // 2. Italic
  {
    id: 'markdown.italic',
    label: 'Italic',
    keybindings: [2048 | 39], // Ctrl+I
    contextMenuGroupId: 'markdown',
    contextMenuOrder: 2,
    run: (editor) => wrapSelection(editor, '*', '*', 'italic')
  },

  // 3. Code Inline
  {
    id: 'markdown.codeInline',
    label: 'Inline Code',
    keybindings: [2048 | 88], // Ctrl+`
    contextMenuGroupId: 'markdown',
    contextMenuOrder: 3,
    run: (editor) => wrapSelection(editor, '`', '`', 'code')
  },

  // 4. Code Block
  {
    id: 'markdown.codeBlock',
    label: 'Code Block',
    keybindings: [2048 | 1024 | 33], // Ctrl+Shift+C
    contextMenuGroupId: 'markdown',
    contextMenuOrder: 4,
    run: (editor) => {
      const selection = editor.getSelection()
      const text = editor.getModel()?.getValueInRange(selection) || ''

      if (text) {
        const wrapped = `\`\`\`\n${text}\n\`\`\``
        editor.executeEdits('', [{ range: selection, text: wrapped }])
      } else {
        insertTemplate(editor, '```\ncode\n```', 3)
      }
    }
  },

  // 5. Heading 1
  {
    id: 'markdown.heading1',
    label: 'Heading 1',
    keybindings: [2048 | 22], // Ctrl+1
    contextMenuGroupId: 'markdown',
    contextMenuOrder: 5,
    run: (editor) => {
      const position = editor.getPosition()
      const model = editor.getModel()
      const lineContent = model.getLineContent(position.lineNumber)

      let newContent = lineContent
      if (lineContent.startsWith('# ')) {
        newContent = lineContent.slice(2)
      } else if (lineContent.match(/^#{1,6} /)) {
        newContent = '# ' + lineContent.replace(/^#{1,6} /, '')
      } else {
        newContent = '# ' + lineContent
      }

      editor.executeEdits('', [{
        range: {
          startLineNumber: position.lineNumber,
          startColumn: 1,
          endLineNumber: position.lineNumber,
          endColumn: lineContent.length + 1
        },
        text: newContent
      }])
    }
  },

  // 6. Heading 2
  {
    id: 'markdown.heading2',
    label: 'Heading 2',
    keybindings: [2048 | 23], // Ctrl+2
    contextMenuGroupId: 'markdown',
    contextMenuOrder: 6,
    run: (editor) => {
      const position = editor.getPosition()
      const model = editor.getModel()
      const lineContent = model.getLineContent(position.lineNumber)

      let newContent = lineContent
      if (lineContent.startsWith('## ')) {
        newContent = lineContent.slice(3)
      } else if (lineContent.match(/^#{1,6} /)) {
        newContent = '## ' + lineContent.replace(/^#{1,6} /, '')
      } else {
        newContent = '## ' + lineContent
      }

      editor.executeEdits('', [{
        range: {
          startLineNumber: position.lineNumber,
          startColumn: 1,
          endLineNumber: position.lineNumber,
          endColumn: lineContent.length + 1
        },
        text: newContent
      }])
    }
  },

  // 7. Heading 3
  {
    id: 'markdown.heading3',
    label: 'Heading 3',
    keybindings: [2048 | 24], // Ctrl+3
    contextMenuGroupId: 'markdown',
    contextMenuOrder: 7,
    run: (editor) => {
      const position = editor.getPosition()
      const model = editor.getModel()
      const lineContent = model.getLineContent(position.lineNumber)

      let newContent = lineContent
      if (lineContent.startsWith('### ')) {
        newContent = lineContent.slice(4)
      } else if (lineContent.match(/^#{1,6} /)) {
        newContent = '### ' + lineContent.replace(/^#{1,6} /, '')
      } else {
        newContent = '### ' + lineContent
      }

      editor.executeEdits('', [{
        range: {
          startLineNumber: position.lineNumber,
          startColumn: 1,
          endLineNumber: position.lineNumber,
          endColumn: lineContent.length + 1
        },
        text: newContent
      }])
    }
  },

  // 8. Bullet List
  {
    id: 'markdown.bulletList',
    label: 'Bullet List',
    keybindings: [2048 | 1024 | 29], // Ctrl+Shift+8
    contextMenuGroupId: 'markdown',
    contextMenuOrder: 8,
    run: (editor) => toggleLinePrefix(editor, '- ', true)
  },

  // 9. Numbered List
  {
    id: 'markdown.numberedList',
    label: 'Numbered List',
    keybindings: [2048 | 1024 | 28], // Ctrl+Shift+7
    contextMenuGroupId: 'markdown',
    contextMenuOrder: 9,
    run: (editor) => {
      const selection = editor.getSelection()
      const model = editor.getModel()
      const startLine = selection.startLineNumber
      const endLine = selection.endLineNumber

      const edits = []
      let number = 1
      for (let lineNum = startLine; lineNum <= endLine; lineNum++) {
        const lineContent = model.getLineContent(lineNum)
        let newContent = lineContent

        if (lineContent.match(/^\d+\. /)) {
          newContent = lineContent.replace(/^\d+\. /, '')
        } else if (lineContent.startsWith('- ')) {
          newContent = `${number}. ` + lineContent.slice(2)
          number++
        } else {
          newContent = `${number}. ` + lineContent
          number++
        }

        edits.push({
          range: {
            startLineNumber: lineNum,
            startColumn: 1,
            endLineNumber: lineNum,
            endColumn: lineContent.length + 1
          },
          text: newContent
        })
      }

      editor.executeEdits('', edits)
    }
  },

  // 10. Blockquote
  {
    id: 'markdown.blockquote',
    label: 'Blockquote',
    keybindings: [2048 | 1024 | 88], // Ctrl+Shift+.
    contextMenuGroupId: 'markdown',
    contextMenuOrder: 10,
    run: (editor) => toggleLinePrefix(editor, '> ')
  },

  // 11. Insert Link
  {
    id: 'markdown.insertLink',
    label: 'Insert Link',
    keybindings: [2048 | 41], // Ctrl+K
    contextMenuGroupId: 'markdown',
    contextMenuOrder: 11,
    run: (editor) => {
      const selection = editor.getSelection()
      const text = editor.getModel()?.getValueInRange(selection) || 'text'
      const linkTemplate = `[${text}](url)`

      editor.executeEdits('', [{ range: selection, text: linkTemplate }])

      // Position cursor at 'url' for immediate typing
      const pos = selection.getStartPosition()
      const urlStart = pos.column + text.length + 3
      editor.setSelection({
        startLineNumber: pos.lineNumber,
        startColumn: urlStart,
        endLineNumber: pos.lineNumber,
        endColumn: urlStart + 3
      })
    }
  },

  // 12. Insert Table
  {
    id: 'markdown.insertTable',
    label: 'Insert Table',
    contextMenuGroupId: 'markdown',
    contextMenuOrder: 12,
    run: (editor) => {
      const tableTemplate =
`| Header 1 | Header 2 | Header 3 |
|----------|----------|----------|
| Cell 1   | Cell 2   | Cell 3   |
| Cell 4   | Cell 5   | Cell 6   |`

      insertTemplate(editor, tableTemplate, 2)
    }
  }
]
```

**Verification**:
1. File compiles without TypeScript errors
2. Exports are valid and match interface
3. Helper functions handle edge cases

**Success Criteria**:
- ✅ All 10 markdown actions defined
- ✅ Helper functions implemented and DRY
- ✅ TypeScript types correct
- ✅ Keybinding codes accurate

---

### Task 3: Integrate Markdown Actions into Editor (30 min)
**File**: `src/features/editor/components/Editor.tsx`

**Changes**:

1. **Add import** (after existing imports, ~line 20):
```typescript
import { markdownActions } from '../markdown-actions'
```

2. **Register actions in handleMount** (after updateOptions call, ~line 75):
```typescript
function handleMount(editor: any, monaco: any) {
  editorRef.current = editor

  // Configure editor options with sensible defaults
  editor.updateOptions({
    fontSize: 13,  // P5S4T1: Reduced from 14
    fontFamily: 'var(--font-geist-mono, monospace)',
    lineHeight: 1.6,
    padding: { top: 16, bottom: 16 },
    scrollBeyondLastLine: false,
    minimap: { enabled: false },
    renderLineHighlight: 'line',
    smoothScrolling: true,
    cursorBlinking: 'smooth',
    cursorSmoothCaretAnimation: 'on',
    ...options
  })

  // Reason: Register markdown editor actions (P5S4T3)
  markdownActions.forEach(action => {
    editor.addAction({
      id: action.id,
      label: action.label,
      keybindings: action.keybindings,
      contextMenuGroupId: action.contextMenuGroupId,
      contextMenuOrder: action.contextMenuOrder,
      run: () => action.run(editor)
    })
  })

  // Call user's onMount if provided
  if (onMount) {
    onMount(editor, monaco)
  }
}
```

**Verification**:
1. Build succeeds: `npm run build`
2. No TypeScript errors
3. No runtime errors in console

**Success Criteria**:
- ✅ Import resolves correctly
- ✅ Actions register without errors
- ✅ Editor mounts successfully
- ✅ No console errors

---

### Task 4: Functional Testing of Markdown Actions (45 min)

**Test Matrix**: Verify each action in multiple scenarios

#### Test 1: Bold (Ctrl+B)
1. Type "hello world" → select "world" → press Ctrl+B → verify: "hello **world**"
2. No selection → press Ctrl+B → verify: "**bold**" inserted with cursor between asterisks
3. Select "**bold**" → press Ctrl+B → verify: "bold" (toggle removes formatting)

#### Test 2: Italic (Ctrl+I)
1. Type "hello world" → select "world" → press Ctrl+I → verify: "hello *world*"
2. No selection → press Ctrl+I → verify: "*italic*" inserted
3. Select "*italic*" → press Ctrl+I → verify: "italic" (toggle)

#### Test 3: Headings (Ctrl+1, Ctrl+2, Ctrl+3)
1. Type "Title" → cursor on line → press Ctrl+1 → verify: "# Title"
2. "# Title" → press Ctrl+1 → verify: "Title" (toggle removes)
3. "# Title" → press Ctrl+2 → verify: "## Title" (replaces heading level)

#### Test 4: Code Inline (Ctrl+`)
1. Select "code" → press Ctrl+` → verify: "`code`"
2. No selection → press Ctrl+` → verify: "`code`" inserted

#### Test 5: Code Block (Ctrl+Shift+C)
1. Select multiple lines → press Ctrl+Shift+C → verify wrapped in triple backticks
2. No selection → press Ctrl+Shift+C → verify template inserted

#### Test 6: Lists (Ctrl+Shift+8, Ctrl+Shift+7)
1. Type "Item 1\nItem 2\nItem 3" → select all → press Ctrl+Shift+8 → verify bullet list
2. Bullet list → press Ctrl+Shift+7 → verify numbered list (1., 2., 3.)
3. Numbered list → press Ctrl+Shift+8 → verify back to bullets
4. Bullet list → press Ctrl+Shift+8 → verify removes bullets (toggle)

#### Test 7: Blockquote (Ctrl+Shift+.)
1. Type "quote" → press Ctrl+Shift+. → verify: "> quote"
2. "> quote" → press Ctrl+Shift+. → verify: "quote" (toggle)

#### Test 8: Insert Link (Ctrl+K)
1. Select "GitHub" → press Ctrl+K → verify: "[GitHub](url)" with "url" selected
2. No selection → press Ctrl+K → verify: "[text](url)" with cursor at url

#### Test 9: Insert Table
1. Right-click in editor → select "Insert Table" → verify 3x3 table template inserted
2. Verify cursor positioned in first header cell

#### Test 10: Context Menu
1. Right-click in editor → verify "Markdown" submenu exists
2. Verify all 10 actions appear in submenu
3. Verify order matches contextMenuOrder

**Success Criteria**:
- ✅ All 10 actions work as specified
- ✅ Toggle behaviors function correctly
- ✅ Keyboard shortcuts recognized
- ✅ Context menu displays all actions
- ✅ Edge cases handled (empty selection, etc.)

---

### Task 5: Final Verification and Regression Testing (30 min)

#### Build and Lint Validation
```bash
# Must pass without errors
npm run lint
npm run build
```

#### Regression Tests (Verify P5S3b/P5S3d not broken)
1. **Auto-save**: Type in editor → wait 500ms → verify auto-save indicator appears
2. **Manual save**: Press Ctrl+S → verify "Version saved successfully" toast
3. **Loading states**: Create new prompt → verify skeleton → verify content loads
4. **Editor height**: Verify Monaco fills vertical space from subheader to footer
5. **Font size**: Verify code renders at 13px (measure in DevTools)
6. **Theme**: Verify boldSimplicity theme active (check colors match design system)

#### Integration Tests
1. **Full workflow**:
   - Create new prompt
   - Type markdown content using new actions
   - Apply bold, italic, headings, lists, code blocks
   - Auto-save triggers (check indicator)
   - Manual save with Ctrl+S (check toast)
   - Reload page → verify content persists
   - Check database → verify PromptVersion created

2. **Multi-user isolation**:
   - Sign out
   - Sign in as different user
   - Verify cannot see other user's prompts
   - Verify actions work for new user

**Success Criteria**:
- ✅ Build succeeds with zero errors
- ✅ Lint passes with zero warnings
- ✅ All P5S3b features still work
- ✅ All P5S3d features still work
- ✅ Markdown actions enhance (not break) editing
- ✅ No console errors or warnings
- ✅ No visual regressions

## Validation Gates

### Must Pass Before Completion

```bash
# 1. TypeScript Compilation
npm run build
# Expected: Build succeeds, no errors, no warnings

# 2. Linting
npm run lint
# Expected: No errors, no warnings

# 3. Development Server
npm run dev
# Expected: Server starts on port 3010, no errors

# 4. Visual Verification
# Navigate to: http://localhost:3010/dashboard
# - Sign in if not authenticated
# - Create or open a prompt
# - Verify Monaco editor renders correctly
# - Verify font size appears correct (13px)

# 5. Functional Testing
# In editor, test each markdown action:
# - Ctrl+B (bold)
# - Ctrl+I (italic)
# - Ctrl+1/2/3 (headings)
# - Ctrl+` (inline code)
# - Ctrl+Shift+C (code block)
# - Ctrl+Shift+8 (bullet list)
# - Ctrl+Shift+7 (numbered list)
# - Ctrl+Shift+. (blockquote)
# - Ctrl+K (insert link)
# - Right-click → Insert Table

# 6. Regression Testing
# - Type content → wait 500ms → verify auto-save indicator
# - Press Ctrl+S → verify "Version saved" toast
# - Reload page → verify content persists
# - Check console → no errors

# 7. Database Verification
# - After manual save, check Supabase:
#   - Prompts table: content updated
#   - PromptVersions table: new version created with diff
```

### Quality Checklist

- [ ] Font size reduced to 13px (verified in DevTools)
- [ ] All 10 markdown actions implemented
- [ ] Keyboard shortcuts work (verified by testing)
- [ ] Context menu displays all actions under "Markdown" group
- [ ] Toggle behaviors work correctly (bold, italic, lists, headings)
- [ ] Empty selection handled gracefully (placeholder text inserted)
- [ ] Multi-line actions work (lists, blockquotes)
- [ ] Auto-save still works (P5S3b regression test)
- [ ] Manual save still works (P5S3b regression test)
- [ ] Monaco editor height correct (P5S3d regression test)
- [ ] No console errors or warnings
- [ ] Build succeeds with zero errors
- [ ] Lint passes with zero warnings
- [ ] TypeScript types correct (no `any` without justification)
- [ ] File size under 500 lines (Editor.tsx ~200 lines, markdown-actions.ts ~400 lines)

## References

### Existing Code Patterns

1. **Editor Component**: `src/features/editor/components/Editor.tsx`
   - Lines 52-150: handleMount pattern
   - Lines 67-75: updateOptions configuration
   - Reference for integration point

2. **EditorPane Component**: `src/features/editor/components/EditorPane.tsx`
   - Lines 43-206: Complete save workflow
   - Lines 75-85: Auto-save hook usage
   - Lines 104-120: Manual save implementation
   - Lines 122-132: Ctrl+S keyboard listener

3. **Server Actions**: `src/features/editor/actions.ts`
   - Lines 37-106: saveNewVersion (atomic transaction pattern)
   - Lines 118-165: autoSavePrompt (update-only pattern)

4. **Validation Schemas**: `src/features/editor/schemas.ts`
   - Lines 21-27: saveNewVersionSchema (Zod pattern)
   - Lines 29-34: autoSaveSchema (Zod pattern)

### External Documentation

1. **Monaco Editor API**:
   - Editor Actions: https://microsoft.github.io/monaco-editor/api/interfaces/monaco.editor.IStandaloneCodeEditor.html#addAction
   - Keybindings: https://microsoft.github.io/monaco-editor/api/enums/monaco.KeyCode.html
   - Edit Operations: https://microsoft.github.io/monaco-editor/api/interfaces/monaco.editor.IStandaloneCodeEditor.html#executeEdits

2. **Markdown Syntax**:
   - CommonMark Spec: https://commonmark.org/
   - GitHub Flavored Markdown: https://github.github.com/gfm/
   - Tables: https://github.github.com/gfm/#tables-extension-

3. **Related Projects**:
   - monaco-markdown (VS Code extension port): https://github.com/trofimander/monaco-markdown
   - Monaco Editor Examples: https://microsoft.github.io/monaco-editor/playground.html

### Technology Stack

- **Monaco Editor**: @monaco-editor/react ^4.6.0
- **Next.js**: 14.2.3 (Pages Router)
- **TypeScript**: 5.4.5 (strict mode)
- **React**: 18.3.1

### Dependencies (Already Installed)

```json
{
  "@monaco-editor/react": "^4.6.0",
  "monaco-editor": "^0.50.0"
}
```

### Key Constraints

1. **SSR Safety**: Monaco requires `ssr: false` in dynamic import (already handled)
2. **Height Issue**: Monaco needs explicit height or flex container (fixed in P5S3d)
3. **Theme**: Must use "boldSimplicity" custom theme (already implemented)
4. **Keybindings**: Must not conflict with browser/system shortcuts
5. **Multi-line**: List and blockquote actions must handle multiple lines

### Design System Reference

- **Font Family**: var(--font-geist-mono, monospace)
- **Font Size**: 13px (P5S4 requirement)
- **Line Height**: 1.6
- **Colors**: From globals.css CSS variables
- **Primary**: #4F46E5 (Indigo)
- **Accent**: #EC4899 (Magenta)

---

**PRP Status**: COMPLETE
**PRP ID**: P5S4
**Archon Project**: PromptHub (d449f266-1f36-47ad-bd2d-30f1a0f5e999)
**PRP Document**: PRPs/P5S4-editor-ui-with-manual-save.md
**Tasks**: 5 tasks (P5S4T1 - P5S4T5)
**Phase**: Phase 5 - Prompt Editor & Version Control
**Dependencies**: P5S3d (Complete), P5S3b (Complete), P5S3 (Complete)
**Next PRP**: P5S5 - Version History UI
**Recommendations:**
Agents:
- `senior-frontend-engineer` (Tasks 1-3: Font size, markdown actions, integration)
- `qa-test-automation-engineer` (Tasks 4-5: Testing and validation)
Notes:
- All 5 tasks completed successfully
- Font size reduced from 14px to 13px
- 12 markdown actions implemented (exceeded spec of 10)
- Zero build/lint/TypeScript errors
- No regressions to P5S3b/P5S3d features
- Comprehensive test documentation created
- Implementation time: ~2.5 hours (matched estimate)
**Estimated Implementation Time (FTE)**: 2-3 hours
