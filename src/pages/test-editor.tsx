/*
Project: PromptHub
Author: Allan James
Source: src/pages/test-editor.tsx
MIME: text/typescript
Type: TypeScript React Component

Created: 07/11/2025 13:28 GMT+10
Last modified: 07/11/2025 13:28 GMT+10
---------------
Test page for Monaco Editor component verification.
Demonstrates controlled usage, callbacks, and theme integration.

Changelog:
07/11/2025 13:28 GMT+10 | Initial creation with controlled editor demo
*/

"use client"

import { useState } from 'react'
import Editor from '@/features/editor/components/Editor'

/**
 * Test page for Monaco Editor component
 *
 * Validates:
 * - SSR handling (no window/document errors)
 * - Theme matches Bold Simplicity
 * - onChange callback functionality
 * - onMount callback functionality
 * - Controlled mode state management
 */
export default function TestEditorPage() {
  const [content, setContent] = useState('# Hello Monaco\n\nStart editing your prompt here...\n\n## Features\n- Syntax highlighting\n- VS Code keyboard shortcuts\n- Auto-completion\n- Multi-cursor editing\n\nTry editing this text!')

  function handleChange(value: string | undefined) {
    setContent(value || '')
    console.log('Content changed, length:', value?.length || 0)
  }

  function handleMount(editor: any, monaco: any) {
    console.log('Editor mounted successfully:', {
      editor: !!editor,
      monaco: !!monaco,
      model: editor.getModel(),
    })
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-8 max-w-6xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Monaco Editor Test</h1>
          <p className="text-muted">
            Testing P5S1 Monaco Editor integration with Bold Simplicity theme
          </p>
        </div>

        {/* Editor Stats */}
        <div className="mb-4 p-4 bg-card rounded-md border border-border">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-muted">Characters:</span>{' '}
              <span className="font-semibold">{content.length}</span>
            </div>
            <div>
              <span className="text-muted">Lines:</span>{' '}
              <span className="font-semibold">{content.split('\n').length}</span>
            </div>
            <div>
              <span className="text-muted">Words:</span>{' '}
              <span className="font-semibold">
                {content.split(/\s+/).filter(w => w.length > 0).length}
              </span>
            </div>
            <div>
              <span className="text-muted">Language:</span>{' '}
              <span className="font-semibold">Markdown</span>
            </div>
          </div>
        </div>

        {/* Monaco Editor */}
        <div className="mb-6">
          <Editor
            value={content}
            onChange={handleChange}
            onMount={handleMount}
            language="markdown"
            height="600px"
            className="shadow-lg"
          />
        </div>

        {/* Content Preview */}
        <div className="bg-card rounded-md border border-border p-6">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <span className="w-2 h-2 bg-accent rounded-full"></span>
            Raw Content Preview
          </h2>
          <pre className="text-sm text-foreground/80 whitespace-pre-wrap font-mono bg-background/50 p-4 rounded border border-border overflow-x-auto">
            {content}
          </pre>
        </div>

        {/* Testing Checklist */}
        <div className="mt-8 p-4 bg-card/50 rounded-md border border-border">
          <h3 className="font-semibold mb-2 text-sm">Testing Checklist</h3>
          <ul className="text-xs text-muted space-y-1">
            <li>✓ EditorSkeleton shows during load</li>
            <li>✓ Editor renders with dark theme</li>
            <li>✓ Background color is #0F172A</li>
            <li>✓ onChange fires on content change</li>
            <li>✓ onMount provides editor instance (check console)</li>
            <li>✓ Character count updates in real-time</li>
            <li>✓ No console errors</li>
            <li>✓ Typing is smooth and responsive</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
