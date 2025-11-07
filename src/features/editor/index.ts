/*
Project: PromptHub
Author: Allan James
Source: src/features/editor/index.ts
MIME: text/typescript
Type: TypeScript

Created: 07/11/2025 13:28 GMT+10
Last modified: 07/11/2025 13:28 GMT+10
---------------
Centralized exports for the editor feature module.
Provides clean import paths for Editor components and types.

Changelog:
07/11/2025 13:28 GMT+10 | Initial creation with component and type exports
*/

// Component exports
export { default as Editor } from './components/Editor'
export { default as EditorSkeleton } from './components/EditorSkeleton'

// Type exports
export type {
  EditorProps,
  EditorSkeletonProps,
  OnChange,
  OnMount,
  BeforeMount
} from './types'
