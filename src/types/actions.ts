/*
Project: PromptHub
Author: Allan James
Source: src/types/actions.ts
MIME: text/x-typescript
Type: TypeScript Type Definitions

Created: 07/11/2025 14:00 GMT+10
Last modified: 07/11/2025 14:00 GMT+10
---------------
Centralized type definitions for server actions across the application.

Changelog:
07/11/2025 14:00 GMT+10 | Initial creation - centralized ActionResult type from multiple files
*/

/**
 * Generic result type for server actions
 *
 * Provides type-safe discriminated union for server action responses.
 * Use the generic parameter T to specify the data type on success.
 *
 * @template T - The type of data returned on success (defaults to any)
 *
 * @example
 * ```typescript
 * // Without specific data type
 * export async function deleteItem(): Promise<ActionResult> {
 *   return { success: true, data: undefined }
 * }
 *
 * // With specific data type
 * export async function createItem(): Promise<ActionResult<{ id: string }>> {
 *   return { success: true, data: { id: "123" } }
 * }
 *
 * // Error response
 * export async function failingAction(): Promise<ActionResult> {
 *   return { success: false, error: "Something went wrong" }
 * }
 * ```
 */
export type ActionResult<T = any> =
  | { success: true; data: T }
  | { success: false; error: string }
