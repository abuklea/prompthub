/*
Project: PromptHub
Author: Allan James
Source: src/features/prompts/utils.ts
MIME: text/typescript
Type: TypeScript

Created: 08/11/2025 17:27 GMT+10
Last modified: 08/11/2025 17:27 GMT+10
---------------
Utility functions for prompt operations.
Provides display helpers and formatting functions.

Changelog:
08/11/2025 17:27 GMT+10 | Initial creation with getDisplayTitle helper
*/

/**
 * Get display title for a prompt.
 * Returns "[Untitled Doc]" placeholder for null, undefined, empty, or whitespace titles.
 * Otherwise returns the trimmed actual title.
 */
export function getDisplayTitle(title: string | null | undefined): string {
  return title?.trim() || '[Untitled Doc]'
}
