/*
Project: PromptHub
Author: Allan James
Source: src/features/editor/hooks/useAutoSave.ts
MIME: text/typescript
Type: TypeScript React Hook

Created: 07/11/2025 16:12 GMT+10
Last modified: 07/11/2025 16:12 GMT+10
---------------
Custom React hook for debounced auto-save functionality.
Triggers save after specified delay (500ms default) when content changes.

Changelog:
07/11/2025 16:12 GMT+10 | Initial creation (P5S3bT11)
*/

import { useEffect, useRef } from 'react'

export interface UseAutoSaveOptions {
  content: string
  promptId: string | null
  delay?: number
  onSave: (promptId: string, content: string) => void
}

/**
 * useAutoSave - Debounced auto-save hook
 * 
 * Automatically saves content after a delay when typing stops.
 * Resets the timer on each content change (debouncing).
 * 
 * @param content - Current editor content
 * @param promptId - ID of prompt being edited (null = no save)
 * @param delay - Debounce delay in milliseconds (default: 500ms)
 * @param onSave - Callback function to execute save
 * 
 * @example
 * ```tsx
 * useAutoSave({
 *   content,
 *   promptId: selectedPrompt,
 *   delay: 500,
 *   onSave: async (id, content) => {
 *     await autoSavePrompt({ promptId: id, content })
 *   }
 * })
 * ```
 */
export function useAutoSave({ 
  content, 
  promptId, 
  delay = 500, 
  onSave 
}: UseAutoSaveOptions) {
  const timeoutRef = useRef<NodeJS.Timeout>()
  
  useEffect(() => {
    // Reason: Skip auto-save if no prompt is selected
    if (!promptId) return
    
    // Reason: Clear previous timeout to reset debounce timer
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    
    // Reason: Set new timeout for auto-save
    timeoutRef.current = setTimeout(() => {
      onSave(promptId, content)
    }, delay)
    
    // Reason: Cleanup on unmount or dependency change
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [content, promptId, delay, onSave])
}
