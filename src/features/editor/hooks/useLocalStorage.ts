/*
Project: PromptHub
Author: Allan James
Source: src/features/editor/hooks/useLocalStorage.ts
MIME: text/typescript
Type: TypeScript React Hook

Created: 07/11/2025 16:13 GMT+10
Last modified: 09/11/2025 17:20 GMT+10
---------------
Custom React hook for localStorage persistence.
Provides automatic save/load with SSR-safe implementation.

Changelog:
09/11/2025 17:20 GMT+10 | CRITICAL FIX: Replaced prevKeyRef with justLoadedRef flag to prevent race condition (P5S5T1)
08/11/2025 12:24 GMT+10 | CRITICAL FIX: Prevent saving on key changes (P5S4bT1 root cause)
07/11/2025 16:13 GMT+10 | Initial creation (P5S3bT12)
*/

import { useState, useEffect, useRef } from 'react'

export interface UseLocalStorageOptions {
  key: string
  initialValue: string
}

/**
 * useLocalStorage - Persist state in localStorage
 * 
 * Automatically loads from localStorage on mount and saves on change.
 * Handles SSR by checking for window object availability.
 * 
 * @param key - localStorage key
 * @param initialValue - Default value if nothing in localStorage
 * @returns Tuple: [value, setValue, clearStorage]
 * 
 * @example
 * ```tsx
 * const [draft, setDraft, clearDraft] = useLocalStorage({
 *   key: 'prompt-123',
 *   initialValue: ''
 * })
 * 
 * // Use like useState
 * setDraft(newContent)
 * 
 * // Clear localStorage on save
 * clearDraft()
 * ```
 */
export function useLocalStorage({
  key,
  initialValue
}: UseLocalStorageOptions) {
  // CRITICAL: Track if we just loaded to prevent saving during key transitions (P5S5T1)
  const justLoadedRef = useRef(false)

  // Reason: Initialize from localStorage on mount (SSR-safe)
  const [value, setValue] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(key)
      return saved || initialValue
    }
    return initialValue
  })

  // Reason: Reinitialize value when key changes (document switching)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(key)
      setValue(saved || initialValue)
      // CRITICAL: Mark as just loaded to prevent save effect from triggering (P5S5T1)
      justLoadedRef.current = true
    }
  }, [key, initialValue])

  // CRITICAL: Save to localStorage ONLY when value changes from user edits, NOT on loads (P5S5T1)
  // This prevents saving old document content to new document's localStorage key
  useEffect(() => {
    // Skip save if we just loaded (prevents race condition during key transitions)
    if (justLoadedRef.current) {
      justLoadedRef.current = false
      return
    }

    if (typeof window !== 'undefined') {
      localStorage.setItem(key, value)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])  // CRITICAL: Only [value] dependency - NOT key! (Intentionally excluding 'key' to prevent race condition)
  
  // Reason: Provide function to clear localStorage entry
  const clearStorage = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(key)
    }
  }
  
  return [value, setValue, clearStorage] as const
}
