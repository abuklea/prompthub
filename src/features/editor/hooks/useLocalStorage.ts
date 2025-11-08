/*
Project: PromptHub
Author: Allan James
Source: src/features/editor/hooks/useLocalStorage.ts
MIME: text/typescript
Type: TypeScript React Hook

Created: 07/11/2025 16:13 GMT+10
Last modified: 08/11/2025 12:24 GMT+10
---------------
Custom React hook for localStorage persistence.
Provides automatic save/load with SSR-safe implementation.

Changelog:
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
  // Reason: Track previous key to prevent saving on key changes (P5S4bT1 root cause fix)
  const prevKeyRef = useRef<string>(key)

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
    }
    // Reason: Update ref AFTER loading to prevent save trigger
    prevKeyRef.current = key
  }, [key, initialValue])

  // Reason: Save to localStorage ONLY when value changes, NOT when key changes
  // This prevents saving old document content to new document's localStorage key
  useEffect(() => {
    // Skip save if key just changed (we're loading, not saving)
    if (prevKeyRef.current !== key) {
      return
    }

    if (typeof window !== 'undefined') {
      localStorage.setItem(key, value)
    }
  }, [key, value])
  
  // Reason: Provide function to clear localStorage entry
  const clearStorage = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(key)
    }
  }
  
  return [value, setValue, clearStorage] as const
}
