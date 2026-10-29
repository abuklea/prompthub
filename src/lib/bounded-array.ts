/*
Project: PromptHub
Author: Allan James
Source: src/lib/bounded-array.ts
MIME: text/typescript
Type: TypeScript Module

Created: 29/10/2026 22:12 GMT+10
Last modified: 29/10/2026 22:13 GMT+10
---------------
Zod schema for a length-capped array whose cap is enforced before any element is parsed (finding S-1, P7S2T11).

Changelog:
29/10/2026 22:12 GMT+10 | Created (P7S2T11, issue #121)
*/

import { z } from "zod"

/**
 * An array of `element`, at most `max` long, whose length is checked before any element is parsed.
 *
 * Zod 3's `z.array(element).max(max)` records `too_big` and then parses every element anyway, one issue per bad
 * element, so an oversized body costs work in proportion to its length before the action authenticates. This schema
 * refuses an over-long array in constant time with the single `too_big` issue that `.max(max)` words, and parses no
 * element. Within the cap it behaves as `z.array(element)`: element issues keep their messages and index paths.
 *
 * @param element - The schema for each element.
 * @param max - The largest accepted length, inclusive.
 * @returns A schema whose input is `z.input<T>[]` and output `z.output<T>[]`; composes with `.optional()` and
 *   `.default()`.
 */
export function boundedArray<T extends z.ZodTypeAny>(
  element: T,
  max: number,
): z.ZodType<z.output<T>[], z.ZodTypeDef, z.input<T>[]> {
  // Reason: a failed refinement leaves the first stage dirty, and ZodPipeline (zod 3.25.76) then returns without
  // running the second stage, so z.array never sees an over-long input. A non-array passes the first stage and is
  // refused by z.array with its own invalid_type issue.
  const pipeline = z
    .unknown()
    .superRefine((value, ctx) => {
      if (Array.isArray(value) && value.length > max) {
        ctx.addIssue({ code: z.ZodIssueCode.too_big, maximum: max, type: "array", inclusive: true, exact: false })
      }
    })
    .pipe(z.array(element))
  // Reason: the pipeline's first stage is z.unknown(), so its declared input is `unknown`; that would let an action
  // wrapper typed `z.input<typeof schema>` accept any value. The cast restores the input type of z.array(element),
  // which is exactly what the pipeline accepts: anything else fails the second stage.
  return pipeline as z.ZodType<z.output<T>[], z.ZodTypeDef, z.input<T>[]>
}
