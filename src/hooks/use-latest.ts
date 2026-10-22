/*
Project: PromptHub
Author: Allan James
Source: src/hooks/use-latest.ts
MIME: text/typescript
Type: TypeScript React Hook

Created: 22/10/2026 09:10 GMT+10
Last modified: 22/10/2026 09:14 GMT+10
---------------
useLatest: the latest value in a ref, so a stable callback or an effect can read current props and state without
listing them as dependencies.

Changelog:
22/10/2026 09:14 GMT+10 | Implemented: the ref is written in a passive effect (P7S1T5 step 3)
22/10/2026 09:10 GMT+10 | Created as a stub for the red run of P7S1T5 step 2
*/

import { useEffect, useRef, type MutableRefObject } from "react"

/**
 * Keeps the latest value in a ref that keeps one identity across renders. Reason: the ref is written in a passive
 * effect, never during render, so a render that React discards cannot leak its value; it is therefore one commit
 * behind during a render. Read it in event handlers and effects only.
 * @param value - The value to keep.
 * @returns The ref: the first value at once, then the value of the last committed render.
 */
export function useLatest<T>(value: T): MutableRefObject<T> {
  const ref = useRef(value)
  useEffect(() => {
    ref.current = value
  }, [value])
  return ref
}
