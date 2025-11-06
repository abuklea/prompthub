# PromptHub - Code Style & Conventions

## TypeScript Configuration
- **Strict Mode**: Enabled
- **Module Resolution**: bundler
- **Path Aliases**: `@/*` maps to `src/*`
- **JSX**: preserve (Next.js handles compilation)

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

### Code Naming
- **Components**: PascalCase (`FolderTree`, `AuthForm`)
- **Functions**: camelCase (`signIn`, `createFolder`)
- **Variables**: camelCase (`userData`, `folderList`)
- **Constants**: UPPER_SNAKE_CASE or camelCase
- **Interfaces/Types**: PascalCase (`SignUpSchema`, `FolderProps`)

## Code Structure Rules

### File Size Limits
- **Max 500 lines per file** (mandatory)
- **Max 50 lines per function** (single responsibility)
- **Max 100 characters per line**

### Function Guidelines
- Single, clear responsibility
- Prefer async/await over promise chains
- Early returns for error handling
- Clear, meaningful names

### Component Guidelines
- Functional components with TypeScript interfaces
- Props interface at top of file
- Server Components by default
- Client Components marked with `"use client"`
- Hooks at top of component body

## TypeScript Patterns

### Server Actions
```typescript
"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

export async function actionName(params: Type) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    throw new Error("User not found")
  }
  
  // ... operation
  
  revalidatePath("/")
  return result
}
```

### Component Props
```typescript
interface ComponentNameProps {
  requiredProp: string
  optionalProp?: number
  onAction: (data: DataType) => void
}

export function ComponentName({ 
  requiredProp, 
  optionalProp = defaultValue,
  onAction 
}: ComponentNameProps) {
  // Implementation
}
```

## Import Organization
1. External libraries (React, Next.js, etc.)
2. Internal absolute imports (`@/...`)
3. Relative imports
4. Types (if needed)

```typescript
import { useState } from "react"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import { createFolder } from "@/features/folders/actions"

import { FolderItem } from "./FolderItem"
```

## Documentation

### File Headers
Not currently enforced in source files, but CLAUDE.md and documentation files require:
```markdown
# Project Name
## Document Title

| `Title` | `Created` | `Last modified` |
|---------|-----------|-----------------|
| Title | DD/MM/YYYY HH:mm GMT+10 | DD/MM/YYYY HH:mm GMT+10 |
```

### Code Comments
- Module/file purpose at top (if complex)
- Complex logic with `// Reason:` prefix
- JSDoc for public APIs (when needed)
- Avoid obvious comments
- Document the "why", not the "what"

## Styling Conventions

### Tailwind CSS
- Use utility classes
- No hardcoded colors (use theme variables)
- Responsive design patterns
- Dark mode support via `next-themes`

### CSS Variables
- Use Shadcn Studio theme system
- Variables defined in `globals.css`
- Supports light/dark mode automatically

## Best Practices

### Security
- Never commit secrets
- Use environment variables
- Validate all user input with Zod
- Parameterized database queries (Prisma handles this)
- RLS policies for data isolation

### Performance
- Prefer async/await
- Debounce user input handlers
- Optimize database queries
- Implement loading states
- Handle Supabase server client cookie operations carefully

### Error Handling
- Fail fast: Check errors early
- Throw errors in server actions
- Handle errors in components
- Provide user feedback

### Testing (Target: 80%+ coverage)
- Test-Driven Development (TDD) approach
- Unit tests for functions
- Integration tests for components
- E2E tests for critical paths

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

### SOLID Principles
- Single Responsibility
- Open/Closed
- Dependency Inversion
