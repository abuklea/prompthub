# PromptHub - Code Style & Conventions
Last Updated: 06/11/2025 19:56 GMT+10

## TypeScript Configuration
- **Strict Mode**: Enabled
- **Module Resolution**: bundler
- **Path Aliases**: `@/*` maps to `src/*`
- **JSX**: preserve (Next.js handles compilation)
- **Target**: ES2017
- **Lib**: ES2020, DOM, DOM.Iterable

## Naming Conventions

### Files
| Type | Convention | Example |
|------|------------|---------|
| Components | PascalCase.tsx | `FolderTree.tsx`, `AuthForm.tsx` |
| Pages | kebab-case or lowercase | `login/page.tsx`, `dashboard/page.tsx` |
| Actions | actions.ts | `features/auth/actions.ts` |
| Schemas | schemas.ts | `features/auth/schemas.ts` |
| Utils | camelCase.ts | `utils.ts` |
| Types | *.types.ts | `user.types.ts` (if needed) |
| Stores | use-*.ts | `use-ui-store.ts` |

### Code Naming
- **Components**: PascalCase (`FolderTree`, `AuthForm`)
- **Functions**: camelCase (`signIn`, `createFolder`)
- **Variables**: camelCase (`userData`, `folderList`)
- **Constants**: UPPER_SNAKE_CASE or camelCase (project uses camelCase)
- **Interfaces/Types**: PascalCase (`SignUpSchema`, `FolderItemProps`)
- **Server Actions**: camelCase with descriptive verbs (`getRootFolders`, `saveNewVersion`)

## Code Structure Rules

### File Size Limits
- **Max 500 lines per file** (mandatory)
- **Max 50 lines per function** (single responsibility)
- **Max 100 characters per line**
- Current status: All files well under limits

### Function Guidelines
- Single, clear responsibility
- Prefer async/await over promise chains
- Early returns for error handling
- Clear, meaningful names
- Try-catch blocks for error handling
- Toast notifications for user feedback

### Component Guidelines
- Functional components with TypeScript interfaces
- Props interface defined at top of file or inline
- Server Components by default
- Client Components marked with `"use client"`
- Hooks at top of component body
- Event handlers prefixed with `handle` (e.g., `handleNewFolder`)

## TypeScript Patterns

### Server Actions Pattern
```typescript
"use server"

import { createClient } from "@/lib/supabase/server"
import db from "@/lib/db"
import { revalidatePath } from "next/cache"

export async function actionName(params: Type) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    throw new Error("User not found")
  }

  // Database operation
  const result = await db.model.operation({
    where: { user_id: user.id },
    data: { ...params }
  })

  revalidatePath("/")
  return result
}
```

### Client Component with Props Pattern
```typescript
"use client"

import { useState } from "react"
import { toast } from "sonner"

interface ComponentNameProps {
  requiredProp: string
  optionalProp?: number
  onAction?: (data: DataType) => void
}

export function ComponentName({
  requiredProp,
  optionalProp = defaultValue,
  onAction
}: ComponentNameProps) {
  const [state, setState] = useState<Type>(initialValue)

  const handleAction = async () => {
    try {
      // Logic
      toast.success("Action completed")
      onAction?.(data)
    } catch (error) {
      console.error("Action failed:", error)
      toast.error("Action failed")
    }
  }

  return (
    // JSX
  )
}
```

### Optimistic UI Update Pattern
```typescript
const handleCreate = async () => {
  try {
    const newItem = await createAction(data)
    // Immediately update local state
    setItems((prev) => [...prev, newItem].sort((a, b) => a.name.localeCompare(b.name)))
    toast.success("Created successfully")
  } catch (error) {
    console.error("Failed:", error)
    toast.error("Failed to create")
  }
}
```

## Import Organization
1. External libraries (React, Next.js, etc.)
2. Internal absolute imports (`@/...`)
3. Relative imports
4. Types (if needed separately)

```typescript
import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { createFolder } from "@/features/folders/actions"
import db from "@/lib/db"

import { FolderItem } from "./FolderItem"
```

## Important Import Rules
- **Prisma db**: Use `import db from "@/lib/db"` (default export, NOT named export)
- **Supabase Server**: Use `createClient()` from `@/lib/supabase/server`
- **Supabase Client**: Use `createClient()` from `@/lib/supabase`
- **Toast**: Import `toast` from `"sonner"` for notifications

## Documentation

### Code Comments
- Module/file purpose at top (if complex)
- Complex logic with `// Reason:` prefix
- JSDoc for public APIs (when needed)
- Avoid obvious comments
- Document the "why", not the "what"

### Example
```typescript
// Reason: Update parent's state immediately for optimistic UI
if (onUpdate) {
  onUpdate(folder.id, updatedFolder)
}
```

## Styling Conventions

### Tailwind CSS
- Use utility classes
- No hardcoded colors (use theme variables)
- Responsive design patterns (`sm:`, `md:`, `lg:`)
- Dark mode support via `next-themes`
- Conditional classes using template literals

### Example
```typescript
className={`flex items-center p-1 rounded-md cursor-pointer ${
  isSelected ? "bg-gray-700" : "hover:bg-gray-800"
}`}
```

### CSS Variables
- Use Shadcn Studio theme system
- Variables defined in `globals.css`
- Supports light/dark mode automatically
- Example: `bg-background`, `text-foreground`, `border-input`

## Best Practices

### Security
- Never commit secrets
- Use environment variables
- Validate all user input with Zod
- Parameterized database queries (Prisma handles this)
- RLS policies for data isolation
- User authentication check in all server actions

### Performance
- Prefer async/await
- Debounce user input handlers (when needed)
- Optimize database queries with indexes
- Implement loading states
- Handle Supabase server client cookie operations carefully
- Optimistic UI updates for instant feedback

### Error Handling
- Fail fast: Check errors early
- Throw errors in server actions
- Handle errors in components with try-catch
- Provide user feedback via toast
- Log errors to console for debugging
- Never suppress errors silently

### User Experience
- Toast notifications for all mutations (success/error)
- Loading states for async operations
- Confirmation dialogs for destructive actions
- Immediate UI updates (optimistic)
- Clear error messages

### Testing (Target: 80%+ coverage)
- Test-Driven Development (TDD) approach
- Unit tests for functions
- Integration tests for components
- E2E tests for critical paths
- Test error conditions

## Design Principles

### KISS (Keep It Simple, Stupid)
- Simple solutions over complex ones
- Easy to understand and maintain

### YAGNI (You Aren't Gonna Need It)
- Implement features only when needed
- Avoid speculative development

### DRY (Don't Repeat Yourself)
- Centralize common components
- Single Source of Truth (SSOT)
- Reuse server actions

### SOLID Principles
- Single Responsibility
- Open/Closed
- Dependency Inversion

## Common Patterns in Project

### Callback Props Pattern (for state propagation)
```typescript
interface ItemProps {
  item: Item
  onUpdate?: (itemId: string, updatedItem: Item) => void
  onDelete?: (itemId: string) => void
}
```

### Zustand Store Pattern
```typescript
interface UiStore {
  expandedFolders: Set<string>
  selectedFolder: string | null
  toggleFolder: (folderId: string) => void
  selectFolder: (folderId: string) => void
}

export const useUiStore = create<UiStore>((set) => ({
  expandedFolders: new Set(),
  selectedFolder: null,
  toggleFolder: (folderId) => set((state) => {
    const newExpanded = new Set(state.expandedFolders)
    // toggle logic
    return { expandedFolders: newExpanded }
  }),
  selectFolder: (folderId) => set({ selectedFolder: folderId })
}))
```

### Server Action with Auth Check
```typescript
export async function protectedAction(params: Type) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    throw new Error("User not found")
  }

  // Operation with user.id
}
```
