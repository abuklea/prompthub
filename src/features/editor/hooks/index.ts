/*
Project: PromptHub
Author: Allan James
Source: src/features/editor/hooks/index.ts
MIME: text/typescript
Type: TypeScript

Created: 07/11/2025 16:21 GMT+10
Last modified: 07/11/2025 16:21 GMT+10
---------------
Editor hooks barrel export.
Exports all custom hooks for editor functionality.

Changelog:
07/11/2025 16:21 GMT+10 | Initial creation with useAutoSave and useLocalStorage exports
*/

export { useAutoSave } from './useAutoSave'
export { useLocalStorage } from './useLocalStorage'
export type { UseAutoSaveOptions } from './useAutoSave'
export type { UseLocalStorageOptions } from './useLocalStorage'
