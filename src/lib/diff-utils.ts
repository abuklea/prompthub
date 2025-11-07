/*
Project: PromptHub
Author: Allan James
Source: src/lib/diff-utils.ts
MIME: text/x-typescript
Type: TypeScript Module

Created: 07/11/2025 14:15 GMT+10
Last modified: 07/11/2025 14:15 GMT+10
---------------
Utility wrapper for diff-match-patch library to generate and apply patches
for Git-style version control of prompt content.

Changelog:
07/11/2025 14:15 GMT+10 | Initial implementation of createPatch and applyPatch
*/

import diff_match_patch from 'diff-match-patch'

/**
 * Creates a patch string representing the diff between old and new content
 * Uses Google's diff-match-patch library to generate GNU diff format patches
 * that can be stored in the database for efficient version control.
 *
 * This function is used when saving a new version of a prompt to calculate
 * the difference from the current content, rather than storing full content
 * for every version.
 *
 * CRITICAL: Uses patch_make (not diff_main) to create storable patches.
 *
 * @param oldContent - The original/current content
 * @param newContent - The updated content to save
 * @returns Serialized patch string suitable for database storage
 *
 * @example
 * ```typescript
 * const patch = createPatch("Hello world", "Hello there world")
 * // Returns: "@@ -1,11 +1,17 @@\n Hello \n+there \n world\n"
 * ```
 */
export function createPatch(oldContent: string, newContent: string): string {
  // PATTERN: Create new instance (thread-safe)
  const dmp = new diff_match_patch()

  // CRITICAL: Use patch_make NOT diff_main
  // patch_make returns Patch objects that can be serialized for storage
  const patches = dmp.patch_make(oldContent, newContent)

  // CRITICAL: Serialize to text for storage
  const patchText = dmp.patch_toText(patches)

  return patchText
}

/**
 * Applies a patch to base content to reconstruct a version
 * For future use in version history reconstruction (P5S5)
 *
 * Deserializes a patch string from the database and applies it to the base
 * content to reconstruct a specific version. This enables efficient storage
 * by only storing diffs rather than full content for each version.
 *
 * @param baseContent - The content to apply patch to (usually the current version)
 * @param patchText - Serialized patch string from database
 * @returns Reconstructed content or null if patch application fails
 *
 * @example
 * ```typescript
 * const original = "Hello world"
 * const patch = "@@ -1,11 +1,17 @@\n Hello \n+there \n world\n"
 * const result = applyPatch(original, patch)
 * // Returns: "Hello there world"
 * ```
 */
export function applyPatch(
  baseContent: string,
  patchText: string
): string | null {
  // PATTERN: Create new instance (thread-safe)
  const dmp = new diff_match_patch()

  // Deserialize patch from database
  const patches = dmp.patch_fromText(patchText)

  // Apply patch and get results
  // GOTCHA: patch_apply returns [reconstructedText, resultsArray]
  // resultsArray contains boolean for each patch (true = success, false = failure)
  const [reconstructed, results] = dmp.patch_apply(patches, baseContent)

  // GOTCHA: results is array of booleans (one per patch)
  // If any patch failed, return null to indicate failure
  const allSuccess = results.every((r: boolean) => r === true)

  return allSuccess ? reconstructed : null
}
