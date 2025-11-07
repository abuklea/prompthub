/*
Project: PromptHub
Author: Allan James
Source: src/features/editor/types.ts
MIME: text/typescript
Type: TypeScript

Created: 07/11/2025 13:24 GMT+10
Last modified: 07/11/2025 13:24 GMT+10
---------------
TypeScript type definitions for the Monaco Editor wrapper component.
Provides type safety for Editor and EditorSkeleton components.

Changelog:
07/11/2025 13:24 GMT+10 | Initial creation with EditorProps and EditorSkeletonProps
*/

import type { OnChange, OnMount, BeforeMount } from '@monaco-editor/react'

/**
 * Props for the Editor component
 *
 * The Editor component wraps Monaco Editor for use in Next.js with SSR handling.
 * It supports both controlled and uncontrolled modes.
 */
export interface EditorProps {
  /**
   * Controlled value - when provided, the editor operates in controlled mode
   * Must be paired with onChange handler
   */
  value?: string

  /**
   * Initial value for uncontrolled mode
   * Used when the component manages its own state
   */
  defaultValue?: string

  /**
   * Programming language for syntax highlighting
   * Examples: "markdown", "javascript", "typescript", "json", "python"
   * @default "markdown"
   */
  language?: string

  /**
   * Editor height - REQUIRED for Monaco to render properly
   * Can be a number (pixels) or string ("500px", "80vh")
   * @default "500px"
   */
  height?: string | number

  /**
   * Monaco theme to apply
   * Use "vs-dark" for default dark theme or "boldSimplicity" for custom theme
   * @default "vs-dark"
   */
  theme?: 'vs-dark' | 'light' | string

  /**
   * Whether the editor is read-only
   * @default false
   */
  readOnly?: boolean

  /**
   * Callback fired when editor content changes
   * Receives the new value (or undefined if editor is empty)
   */
  onChange?: OnChange

  /**
   * Callback fired when editor instance is mounted
   * Provides access to editor and monaco instances for advanced configuration
   */
  onMount?: OnMount

  /**
   * Callback fired before editor instance is mounted
   * Used for theme definition and early configuration
   * Must be used for monaco.editor.defineTheme() calls
   */
  beforeMount?: BeforeMount

  /**
   * Monaco editor options
   * See: IStandaloneEditorConstructionOptions in Monaco API
   * Common options: fontSize, fontFamily, minimap, lineNumbers, etc.
   */
  options?: object

  /**
   * Additional CSS classes for the wrapper div
   * Merged with default classes using cn() utility
   */
  className?: string
}

/**
 * Props for the EditorSkeleton loading component
 *
 * Displays during dynamic import of Monaco Editor to prevent layout shift
 */
export interface EditorSkeletonProps {
  /**
   * Height to match the editor that will be loaded
   * Should match the Editor component's height prop
   * @default "500px"
   */
  height?: string | number

  /**
   * Additional CSS classes for the skeleton wrapper
   */
  className?: string
}

// Re-export Monaco types for convenience
export type { OnChange, OnMount, BeforeMount }
