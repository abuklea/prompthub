# PromptHub - Code Style & Conventions
Last Updated: 07/11/2025 02:15 GMT+10

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
| Components | PascalCase.tsx | `AuthForm.tsx`, `FormError.tsx` |
| Pages | kebab-case or lowercase | `login.tsx`, `dashboard.tsx` |
| Actions | actions.ts | `features/auth/actions.ts` |
| Schemas | schemas.ts | `features/auth/schemas.ts` |
| Utils | camelCase.ts | `utils.ts` |
| Types | *.types.ts | `user.types.ts` (if needed) |

### Code Naming
- **Components**: PascalCase (`AuthForm`, `FormError`)
- **Functions**: camelCase (`signIn`, `signUp`)
- **Variables**: camelCase (`userData`, `isRedirecting`)
- **Constants**: UPPER_SNAKE_CASE or camelCase (project uses camelCase)
- **Interfaces/Types**: PascalCase (`SignUpSchema`, `AuthFormProps`)
- **Server Actions**: camelCase with descriptive verbs (`signIn`, `signUp`, `signOut`)

## Code Structure Rules

### File Size Limits
- **Max 500 lines per file** (mandatory)
- **Max 50 lines per function** (single responsibility)
- **Max 100 characters per line**
- Current status: All P1S1 files well under limits

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
- Client Components marked with `"use client"`
- Hooks at top of component body
- Event handlers prefixed with `handle` (e.g., `handleSubmit`)

## TypeScript Patterns (P1S1)

### Server Action Pattern (Error Objects, Not Throws)
```typescript
"use server"

import { createClient } from "@/lib/supabase/server"
import { signInSchema } from "./schemas"

export async function signIn(data: unknown) {
  // Validate input
  const parsed = signInSchema.safeParse(data)
  if (!parsed.success) {
    return { error: "Invalid input" }
  }

  // Supabase operation
  const supabase = createClient()
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password
  })

  // Return error object (NEVER throw)
  if (error) {
    return { error: error.message }
  }

  return { success: true }
}
```

**Key Pattern**: Server actions return `{ error: string }` or `{ success: true }`, never throw exceptions.

### Client Component with Dual Feedback Pattern
```typescript
"use client"

import { useState } from "react"
import { toast } from "sonner"
import { signIn } from "@/features/auth/actions"

export function AuthForm() {
  const [formError, setFormError] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (data: FormData) => {
    setIsLoading(true)
    setFormError("") // Clear previous inline error

    const result = await signIn(data)

    if (result.error) {
      // Dual feedback
      setFormError(result.error)           // Inline error
      toast.error(result.error, {          // Toast notification
        duration: 6000
      })
      setIsLoading(false)
      return
    }

    // Success feedback
    toast.success("Signed in successfully", {
      duration: 3000
    })
    setIsRedirecting(true)
    router.push("/dashboard")
  }

  return (
    <form onSubmit={handleSubmit}>
      {/* Form fields */}
      <FormError message={formError} />
    </form>
  )
}
```

**Key Patterns**:
- **Dual Feedback**: Toast + inline errors
- **Toast Durations**: 6s for errors, 3s for success
- **State Management**: Separate loading/error/redirecting states
- **Error Clearing**: Clear inline errors on new submission

### Form Error Component Pattern
```typescript
interface FormErrorProps {
  message?: string
}

export function FormError({ message }: FormErrorProps) {
  if (!message) return null

  return (
    <div className="flex items-center gap-2 text-sm text-red-500">
      <AlertCircle className="h-4 w-4" />
      <p>{message}</p>
    </div>
  )
}
```

**Key Pattern**: Conditional rendering based on message presence.

### Context-Aware Component Pattern
```typescript
"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"

export function Header() {
  const [user, setUser] = useState<User | null>(null)
  const supabase = createClient()

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
    }
    getUser()
  }, [])

  return (
    <header>
      {user ? (
        <button onClick={handleSignOut}>Sign Out</button>
      ) : (
        <Link href="/login">Sign In</Link>
      )}
    </header>
  )
}
```

**Key Pattern**: Component adapts UI based on authentication state.

### Form Change Detection Pattern
```typescript
"use client"

import { useEffect } from "react"
import { useFormState } from "react-hook-form"

export function AuthForm() {
  const { isDirty } = useFormState()
  const [formError, setFormError] = useState("")

  // Clear inline error when user changes form
  useEffect(() => {
    if (isDirty) {
      setFormError("")
    }
  }, [isDirty])

  // ...
}
```

**Key Pattern**: Clear errors when user modifies form, improving UX.

### Loading and Redirect States Pattern
```typescript
const [isLoading, setIsLoading] = useState(false)
const [isRedirecting, setIsRedirecting] = useState(false)

// During submission
if (isLoading) {
  return <Button disabled>Signing in...</Button>
}

// After success
if (isRedirecting) {
  return <p>Redirecting to dashboard...</p>
}
```

**Key Pattern**: Separate states for loading and redirecting feedback.

## Import Organization
1. React and Next.js
2. Third-party libraries
3. Internal absolute imports (`@/...`)
4. Relative imports
5. Types (if needed separately)

```typescript
import { useState } from "react"
import { useRouter } from "next/router"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { signIn } from "@/features/auth/actions"
import { createClient } from "@/lib/supabase/client"

import { FormError } from "./FormError"
```

## Documentation

### Code Comments
- Module/file purpose at top (if complex)
- Complex logic with `// Reason:` prefix
- JSDoc for public APIs (when needed)
- Avoid obvious comments
- Document the "why", not the "what"

### Example
```typescript
// Reason: Clear inline error when user changes form
useEffect(() => {
  if (isDirty) {
    setFormError("")
  }
}, [isDirty])
```

## Styling Conventions (P1S1 Bold Simplicity)

### Design System Variables
- **Primary**: Indigo #4F46E5 (`text-primary`, `bg-primary`)
- **Accent**: Magenta #EC4899 (`text-accent`, `bg-accent`)
- **Typography**: Inter font (400, 500, 600 weights)
- **Spacing**: 4px grid system
- **Transitions**: 150ms ease

### Tailwind CSS Classes
```typescript
// Primary button
className="bg-primary text-primary-foreground hover:bg-primary/90"

// Accent button
className="bg-accent text-accent-foreground hover:bg-accent/90"

// Card
className="border border-border bg-card rounded-lg p-6"

// Input
className="border border-input bg-background rounded-md px-3 py-2"
```

### Dark Mode First
- Default theme is dark
- CSS variables defined for dark mode
- Light mode support via theme variables

## Best Practices (P1S1 Patterns)

### Error Handling
- **Server Actions**: Return error objects, never throw
- **Client Components**: Handle errors with try-catch
- **Dual Feedback**: Toast + inline errors
- **Error Clearing**: Clear on form change
- **User-Friendly Messages**: Clear, actionable errors

### Loading States
- **Form Submission**: Disable form, show loading text
- **Redirecting**: Show redirect feedback
- **Button States**: "Sign in" → "Signing in..." → "Redirecting..."

### User Feedback
- **Toast Durations**:
  - Errors: 6000ms (6 seconds)
  - Success: 3000ms (3 seconds)
- **Toast Positioning**: Top center (default)
- **Inline Errors**: Below form fields with icon

### Security
- Never commit secrets
- Validate all input with Zod schemas
- Use Supabase Auth for authentication
- Protected routes via middleware
- Server-side session checks

### Performance
- Prefer async/await
- Client-side navigation (next/router)
- Optimistic UI updates (planned)
- Debounce form submissions (planned)

### User Experience
- Dual feedback system (toast + inline)
- Loading states for all async operations
- Clear error messages
- Immediate feedback on form changes
- Smooth transitions (150ms)

## Design Principles

### KISS (Keep It Simple, Stupid)
- Simple solutions over complex ones
- Easy to understand and maintain
- P1S1 example: Error objects instead of try-catch chains

### YAGNI (You Aren't Gonna Need It)
- Implement features only when needed
- P1S1 example: Basic auth only, no OAuth yet

### DRY (Don't Repeat Yourself)
- Centralize common components
- P1S1 example: FormError component for reusable error display

### SOLID Principles
- Single Responsibility: AuthForm handles auth, FormError handles errors
- Open/Closed: FormError accepts any message prop
- Dependency Inversion: Components depend on abstractions (props)

## P1S1 Specific Patterns

### Server Action Error Handling
- ✅ Return error objects
- ❌ Don't throw exceptions
- ✅ Validate with Zod
- ✅ Return success: true on success

### Dual Feedback System
- ✅ Toast for global feedback
- ✅ Inline errors for form feedback
- ✅ Different durations for errors/success
- ✅ Clear inline errors on form change

### Context-Aware Components
- ✅ Check auth state in useEffect
- ✅ Render different UI based on state
- ✅ Use Supabase client for auth checks

### Loading and Redirect States
- ✅ Separate isLoading and isRedirecting states
- ✅ Show appropriate feedback for each state
- ✅ Disable form during submission

## Testing Patterns (P1S1)

### E2E Testing with Chrome DevTools MCP
- Test complete user flows
- Verify form submissions
- Check error handling
- Validate success paths
- Test accessibility

### Manual Testing Guides
- Step-by-step instructions
- Expected results documented
- Edge cases covered
- Accessibility checks included

## Common Patterns in Project (P1S1)

### Zod Schema Validation
```typescript
import { z } from "zod"

export const signInSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters")
})

export type SignInSchema = z.infer<typeof signInSchema>
```

### Supabase Server Client
```typescript
import { createClient } from "@/lib/supabase/server"

export async function serverAction() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  // ...
}
```

### Supabase Client (Browser)
```typescript
import { createClient } from "@/lib/supabase/client"

export function ClientComponent() {
  const supabase = createClient()
  // ...
}
```
