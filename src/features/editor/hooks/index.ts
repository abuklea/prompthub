/*
Project: PromptHub
Author: Allan James
Source: src/features/editor/hooks/index.ts
MIME: text/typescript
Type: TypeScript

Created: 07/11/2025 16:21 GMT+10
Last modified: 22/10/2026 09:51 GMT+10
---------------
Editor hooks barrel export.
Exports the editor's auto-save hook; the document loader and the draft sync are imported from their own files.

Changelog:
22/10/2026 09:51 GMT+10 | Header text names only the exported auto-save hook (P7S1T6 docs sync)
22/10/2026 09:41 GMT+10 | Removed the deleted local-storage hook's exports (P7S1T6)
07/11/2025 16:21 GMT+10 | Initial creation with useAutoSave and useLocalStorage exports
*/

export { useAutoSave } from './useAutoSave'
export type { UseAutoSaveOptions } from './useAutoSave'
