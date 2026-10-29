/*
Project: PromptHub
Author: Allan James
Source: src/lib/bounded-array.test.ts
MIME: text/typescript
Type: TypeScript Module

Created: 29/10/2026 22:12 GMT+10
Last modified: 29/10/2026 22:12 GMT+10
---------------
Tests for boundedArray: an over-long array fails with one issue and no element parsed (the issue count stands in for
the per-element work of finding S-1), a list within the cap behaves as z.array, non-arrays fail, the input and output
types stay typed, and the three prompt schemas that use it reject an over-long list with one issue.

Changelog:
29/10/2026 22:12 GMT+10 | Created (P7S2T11, issue #121)
*/
import { randomUUID } from "node:crypto"
import { describe, expect, expectTypeOf, it } from "vitest"
import { z } from "zod"
import { assignPromptTagsSchema, getPromptsByFolderSchema, validatePromptsSchema } from "@/features/prompts/schemas"
import { boundedArray } from "./bounded-array"

const MAX = 3
const element = z.string().uuid("Invalid id")
const ids = boundedArray(element, MAX)
/** The schema boundedArray replaces, for comparing issues on the paths where both must agree. */
const plain = z.array(element).max(MAX)

/** `count` distinct valid uuids. */
function uuids(count: number): string[] {
  return Array.from({ length: count }, () => randomUUID())
}

/** `count` numbers: each fails a string element schema. */
function numbers(count: number): number[] {
  return Array.from({ length: count }, (_, index) => index)
}

/** The issues of a failed parse; fails the test if the parse succeeded. */
function issuesOf(result: z.SafeParseReturnType<unknown, unknown>): z.ZodIssue[] {
  expect(result.success).toBe(false)
  return result.success ? [] : result.error.issues
}

describe("boundedArray within the cap", () => {
  it("accepts exactly max valid elements and returns them unchanged", () => {
    const input = uuids(MAX)
    const result = ids.safeParse(input)
    expect(result.success).toBe(true)
    if (result.success) expect(result.data).toEqual(input)
  })

  it("accepts an empty array", () => {
    expect(ids.safeParse([])).toEqual({ success: true, data: [] })
  })

  it("reports a bad element's own issue at its index", () => {
    const input = [randomUUID(), randomUUID(), "not-a-uuid"]
    const issues = issuesOf(ids.safeParse(input))
    expect(issues).toHaveLength(1)
    expect(issues[0]).toMatchObject({ path: [2], message: "Invalid id" })
    expect(issues).toEqual(issuesOf(plain.safeParse(input)))
  })
})

describe("boundedArray over the cap", () => {
  it("refuses max + 1 valid elements with one too_big issue, as z.array().max() words it", () => {
    const input = uuids(MAX + 1)
    const issues = issuesOf(ids.safeParse(input))
    expect(issues).toHaveLength(1)
    expect(issues[0]).toMatchObject({ code: "too_big", maximum: MAX, type: "array", path: [] })
    expect(issues).toEqual(issuesOf(plain.safeParse(input)))
  })

  it("refuses 100,000 invalid elements with one issue: no element is parsed", () => {
    const issues = issuesOf(ids.safeParse(numbers(100_000)))
    expect(issues).toHaveLength(1)
    expect(issues[0]).toMatchObject({ code: "too_big", maximum: MAX })
  })
})

describe("boundedArray on a non-array", () => {
  it.each([
    ["a string", "abc"],
    ["an object", { 0: randomUUID(), length: 1 }],
    ["null", null],
    ["undefined", undefined],
  ])("refuses %s with the issue z.array gives", (_label, input) => {
    const issues = issuesOf(ids.safeParse(input))
    expect(issues).toHaveLength(1)
    expect(issues[0]).toMatchObject({ code: "invalid_type", expected: "array" })
    expect(issues).toEqual(issuesOf(plain.safeParse(input)))
  })
})

describe("boundedArray composed with optional().default([])", () => {
  const optionalIds = boundedArray(element, MAX).optional().default([])

  it("defaults a missing list to an empty one", () => {
    expect(optionalIds.safeParse(undefined)).toEqual({ success: true, data: [] })
  })

  it("still refuses an over-long list with one issue", () => {
    expect(issuesOf(optionalIds.safeParse(numbers(100_000)))).toHaveLength(1)
  })
})

describe("boundedArray types", () => {
  it("keeps the element's input and output types", () => {
    const trimmed = boundedArray(z.string().trim().transform((value) => value.length), MAX)
    expectTypeOf<z.input<typeof ids>>().toEqualTypeOf<string[]>()
    expectTypeOf<z.output<typeof ids>>().toEqualTypeOf<string[]>()
    expectTypeOf<z.input<typeof trimmed>>().toEqualTypeOf<string[]>()
    expectTypeOf<z.output<typeof trimmed>>().toEqualTypeOf<number[]>()
    expect(trimmed.parse([" ab "])).toEqual([2])
  })

  it("keeps the schemas' call-site input types", () => {
    expectTypeOf<z.input<typeof validatePromptsSchema>>().toEqualTypeOf<{ promptIds: string[] }>()
    expectTypeOf<z.input<typeof getPromptsByFolderSchema>["tagIds"]>().toEqualTypeOf<string[] | undefined>()
    expectTypeOf<z.output<typeof getPromptsByFolderSchema>["tagIds"]>().toEqualTypeOf<string[]>()
    expectTypeOf<z.input<typeof assignPromptTagsSchema>["tagIds"]>().toEqualTypeOf<string[]>()

    // Reason: an action wrapper types its parameter as the schema's input; these lines fail `tsc` if that input
    // widens to unknown. The calls run the identity at runtime, so the test itself only proves the file compiles.
    const asValidateInput = (input: z.input<typeof validatePromptsSchema>) => input
    const asAssignInput = (input: z.input<typeof assignPromptTagsSchema>) => input
    // @ts-expect-error a number is not a list of prompt ids
    expect(asValidateInput({ promptIds: 123 })).toEqual({ promptIds: 123 })
    // @ts-expect-error a list of numbers is not a list of tag ids
    expect(asAssignInput({ promptId: randomUUID(), tagIds: [1] }).tagIds).toEqual([1])
  })
})

describe("prompt schemas use the bounded arrays", () => {
  const folderId = randomUUID()
  const promptId = randomUUID()

  it("validatePromptsSchema accepts 200 ids and refuses 201 or a flood with one issue", () => {
    const accepted = uuids(200)
    expect(validatePromptsSchema.safeParse({ promptIds: accepted })).toEqual({
      success: true,
      data: { promptIds: accepted },
    })
    const over = issuesOf(validatePromptsSchema.safeParse({ promptIds: uuids(201) }))
    expect(over).toHaveLength(1)
    expect(over[0]).toMatchObject({ code: "too_big", maximum: 200, path: ["promptIds"] })
    expect(issuesOf(validatePromptsSchema.safeParse({ promptIds: numbers(100_000) }))).toHaveLength(1)
  })

  it("validatePromptsSchema keeps its element bounds", () => {
    const issues = issuesOf(validatePromptsSchema.safeParse({ promptIds: ["ok", "", "x".repeat(65)] }))
    expect(issues.map((issue) => issue.path)).toEqual([
      ["promptIds", 1],
      ["promptIds", 2],
    ])
  })

  it("getPromptsByFolderSchema defaults tagIds, accepts 20 and refuses 21 or a flood with one issue", () => {
    expect(getPromptsByFolderSchema.safeParse({ folderId })).toEqual({ success: true, data: { folderId, tagIds: [] } })
    const twenty = uuids(20)
    expect(getPromptsByFolderSchema.safeParse({ folderId, tagIds: twenty })).toEqual({
      success: true,
      data: { folderId, tagIds: twenty },
    })
    const over = issuesOf(getPromptsByFolderSchema.safeParse({ folderId, tagIds: uuids(21) }))
    expect(over).toHaveLength(1)
    expect(over[0]).toMatchObject({ code: "too_big", maximum: 20, path: ["tagIds"] })
    expect(issuesOf(getPromptsByFolderSchema.safeParse({ folderId, tagIds: numbers(100_000) }))).toHaveLength(1)
  })

  it("assignPromptTagsSchema accepts an empty list, refuses 21 or a flood with one issue, and names a bad id", () => {
    expect(assignPromptTagsSchema.safeParse({ promptId, tagIds: [] })).toEqual({
      success: true,
      data: { promptId, tagIds: [] },
    })
    const over = issuesOf(assignPromptTagsSchema.safeParse({ promptId, tagIds: uuids(21) }))
    expect(over).toHaveLength(1)
    expect(over[0]).toMatchObject({ code: "too_big", maximum: 20, path: ["tagIds"] })
    expect(issuesOf(assignPromptTagsSchema.safeParse({ promptId, tagIds: numbers(100_000) }))).toHaveLength(1)
    const bad = issuesOf(assignPromptTagsSchema.safeParse({ promptId, tagIds: [randomUUID(), "nope"] }))
    expect(bad).toEqual([expect.objectContaining({ path: ["tagIds", 1], message: "Invalid tag ID" })])
  })
})
