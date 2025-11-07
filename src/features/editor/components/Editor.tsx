/*
Project: PromptHub
Author: Allan James
Source: src/features/editor/components/Editor.tsx
MIME: text/typescript
Type: TypeScript React Component

Created: 07/11/2025 13:27 GMT+10
Last modified: 07/11/2025 13:27 GMT+10
---------------
Monaco Editor wrapper component with Next.js SSR handling and Bold Simplicity theme.
Uses dynamic import to prevent SSR issues with Monaco's browser dependencies.

Changelog:
07/11/2025 13:27 GMT+10 | Initial creation with dynamic import and custom theme
*/

"use client"

import { useRef } from 'react'
import dynamic from 'next/dynamic'
import type { EditorProps } from '../types'
import { cn } from '@/lib/utils'
import EditorSkeleton from './EditorSkeleton'

// CRITICAL: Dynamic import with SSR disabled
// Monaco Editor requires browser environment (window, document, etc.)
const MonacoEditor = dynamic(() => import('@monaco-editor/react'), {
  ssr: false,  // MUST be false - Monaco breaks SSR
  loading: () => <EditorSkeleton />
})

/**
 * Editor - Monaco Editor wrapper for Next.js
 *
 * Provides a production-ready Monaco Editor with:
 * - SSR handling via dynamic import
 * - Bold Simplicity theme customization
 * - Controlled and uncontrolled modes
 * - TypeScript type safety
 *
 * @example
 * ```tsx
 * <Editor
 *   value={content}
 *   onChange={setContent}
 *   language="markdown"
 *   height="600px"
 * />
 * ```
 */
export default function Editor({
  value,
  defaultValue = '',
  language = 'markdown',
  height = '500px',  // CRITICAL: Monaco needs explicit height
  theme = 'vs-dark',
  readOnly = false,
  onChange,
  onMount,
  beforeMount,
  options = {},
  className = ''
}: EditorProps) {
  const editorRef = useRef<any>(null)

  /**
   * beforeMount handler - Define custom theme BEFORE editor mounts
   * This is the correct place for monaco.editor.defineTheme() calls
   */
  function handleBeforeMount(monaco: any) {
    // Define custom theme matching Bold Simplicity design system
    monaco.editor.defineTheme('boldSimplicity', {
      base: 'vs-dark',
      inherit: true,  // Inherit vs-dark as base
      rules: [],      // Can add custom syntax highlighting rules if needed
      colors: {
        // Map to CSS variables from globals.css
        'editor.background': '#0F172A',              // --background (dark blue-black)
        'editor.foreground': '#E2E8F0',              // --foreground (light text)
        'editorLineNumber.foreground': '#94A3B8',    // --muted (gray for line numbers)
        'editor.selectionBackground': '#4F46E530',   // --primary with opacity
        'editor.lineHighlightBackground': '#11182710', // Subtle line highlight
        'editorCursor.foreground': '#EC4899',        // --accent (magenta cursor)
        'editor.selectionHighlightBackground': '#4F46E520',
        'editorWhitespace.foreground': '#94A3B815',  // Subtle whitespace chars
      }
    })

    // Call user's beforeMount if provided
    if (beforeMount) {
      beforeMount(monaco)
    }
  }

  /**
   * onMount handler - Configure editor instance after mount
   * Provides access to editor and monaco instances for advanced customization
   */
  function handleMount(editor: any, monaco: any) {
    editorRef.current = editor

    // Configure editor options with sensible defaults
    editor.updateOptions({
      fontSize: 14,
      fontFamily: 'var(--font-geist-mono, monospace)',  // Match app font or fallback to monospace
      lineHeight: 1.6,
      padding: { top: 16, bottom: 16 },
      scrollBeyondLastLine: false,
      minimap: { enabled: false },     // Disable for cleaner look
      renderLineHighlight: 'line',
      smoothScrolling: true,
      cursorBlinking: 'smooth',
      cursorSmoothCaretAnimation: 'on',
      ...options  // User options override defaults
    })

    // Call user's onMount if provided
    if (onMount) {
      onMount(editor, monaco)
    }
  }

  // Merge Monaco options with defaults
  const editorOptions = {
    readOnly,
    automaticLayout: true,  // Auto-resize on container change
    scrollbar: {
      verticalScrollbarSize: 8,
      horizontalScrollbarSize: 8,
    },
    ...options
  }

  return (
    <div className={cn("rounded-md border border-border overflow-hidden", className)}>
      <MonacoEditor
        height={height}
        language={language}
        value={value}
        defaultValue={defaultValue}
        theme={theme === 'vs-dark' ? 'boldSimplicity' : theme}
        onChange={onChange}
        onMount={handleMount}
        beforeMount={handleBeforeMount}
        options={editorOptions}
      />
    </div>
  )
}
