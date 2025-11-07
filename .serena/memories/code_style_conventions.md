# PromptHub - Code Style & Conventions
Last Updated: 07/11/2025 20:05 GMT+10

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

## SSR Handling Pattern (P5S1 - Monaco Editor)

### Dynamic Import for SSR-Incompatible Libraries
```typescript
// Problem: Monaco uses window/document APIs, breaks during SSR
// Solution: Dynamic import with ssr: false

import dynamic from "next/dynamic"

const Editor = dynamic(
  () => import("./components/Editor").then(mod => mod.Editor),
  {
    loading: () => <EditorSkeleton />,
    ssr: false  // CRITICAL: Prevents SSR execution
  }
)
```

**Key Principles**:
- Use `dynamic()` from Next.js for SSR-incompatible components
- Set `ssr: false` to skip server-side rendering
- Provide `loading` component (EditorSkeleton) for better UX
- Theme definition in `beforeMount` hook (timing critical)
- Never access window/document outside of event callbacks

### Theme Definition in Monaco beforeMount
```typescript
// Define theme BEFORE component mounts
const onBeforeMount: BeforeMount = (monaco) => {
  monaco.editor.defineTheme("boldSimplicity", {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "comment", foreground: "94A3B8" },
      // ... more rules
    ],
    colors: {
      "editor.background": "#0F172A",      // --background
      "editor.foreground": "#E2E8F0",      // --foreground
      "editor.lineNumbersBackground": "#0F172A",
      "editorLineNumber.foreground": "#94A3B8", // --muted
      "editorCursor.foreground": "#EC4899",     // --accent
    }
  })
}
```

**Why beforeMount?** Theme must be defined before editor renders, using beforeMount ensures proper timing and monaco instance availability.

## TypeScript Patterns (P1S1 & P5S1)

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

## Color System (P1S1 - Bold Simplicity - VERIFIED PRODUCTION READY)

### CSS Variables (Implemented in globals.css)
**Light Mode**:
```css
:root {
  --primary: 239 84% 67%;      /* Indigo #4F46E5 */
  --accent: 328 85% 70%;       /* Magenta #EC4899 */
  --background: 222 47% 11%;   /* Dark blue-black #0F172A */
  --card: 220 26% 14%;         /* Gray 900 #111827 */
  --foreground: 213 31% 91%;   /* Light text #E2E8F0 */
}

html {
  font-size: 12px;  /* P5S3d: Compact UI (was 16px) */
}
```

**Dark Mode** (`.dark`):
- Same color mappings for consistency
- Full light mode support via theme variables

### Design System Variables (P5S3d: Compact UI Standards)
- **Base Font Size**: 12px (P5S3d: reduced 25% from 16px)
- **Primary**: Indigo #4F46E5 (HSL: 239 84% 67%) - Used for primary buttons, links, accents
- **Accent**: Magenta #EC4899 (HSL: 328 85% 70%) - Used for secondary actions, highlights
- **Typography**: Inter font family (400=normal, 500=medium, 600=semibold)
  - Body text: Inter 400, text-xs (P5S3d)
  - Labels/Navigation: Inter 500, text-xs (P5S3d)
  - Headers/Important: Inter 600, text-xs (P5S3d)
  - Monaco Code: 14px (preserved for readability)
- **Spacing**: 4px grid system (0.5, 1, 2, 3, 4, 6, 8, 12, 16, 24px increments)
- **Transitions**: 150ms ease (smooth animations)
- **Border Radius**: Consistent rounded corners throughout

### Component Sizing Standards (P5S3d: Compact UI)
- **Button Default**: `h-8 px-3 text-xs` (was h-9 px-4 text-sm)
- **Button Small**: `h-7 px-2.5 text-xs` (was h-8 px-3 text-xs)
- **Input**: `h-8 px-2.5 py-1.5` (was h-9 px-3 py-2)
- **Label**: `text-xs` (was text-sm)
- **PanelSubheader**: `h-10 px-3 text-xs` (was h-12 px-4 text-sm)

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

## Editor Component Pattern (P5S1)

### EditorProps Interface
```typescript
interface EditorProps {
  value: string;                        // Current editor content
  onChange?: (value: string) => void;   // Change callback
  language?: string;                    // Language (markdown, javascript, etc.)
  height?: string;                      // CSS height (default: 500px)
  theme?: string;                       // Monaco theme (default: boldSimplicity)
  readOnly?: boolean;                   // Read-only mode
  options?: IStandaloneEditorConstructionOptions; // Monaco options
  onMount?: OnMount;                    // Mount callback
  beforeMount?: BeforeMount;            // Before mount callback
  className?: string;                   // CSS class
  disabled?: boolean;                   // Disabled state
}
```

### Usage Pattern
```typescript
import { Editor } from "@/features/editor"

function PromptEditor() {
  const [content, setContent] = useState("")

  return (
    <Editor
      value={content}
      onChange={setContent}
      language="markdown"
      height="600px"
      onMount={(editor) => console.log("Editor mounted")}
    />
  )
}
```

### Loading Pattern
```typescript
// Automatic with dynamic import
<Editor ... /> // Shows EditorSkeleton while loading
```

### Monaco Editor Height in Flex Containers (P5S3d - CRITICAL PATTERN)

**Problem**: Monaco's `height="100%"` doesn't work in flex containers without explicit height propagation.

**Solution**: Wrap Monaco in absolute positioned container with explicit `h-full` on ALL wrapper ancestors.

```typescript
// EditorPane.tsx (P5S3d fix)
<div className="flex-1 overflow-hidden relative">  {/* flex-1 for flex container */}
  <div className="absolute inset-0 h-full">       {/* CRITICAL: h-full wrapper */}
    <Editor
      height="100%"     {/* Now resolves to correct height */}
      value={content}
      onChange={onChange}
    />
  </div>
</div>
```

**Key Principles** (P5S3d):
- Monaco needs explicit height context when used in flex layouts
- ALL wrapper divs between flex parent and Monaco MUST have `h-full`
- Use `absolute inset-0 h-full` pattern for direct Monaco wrapper
- Pattern: `flex-1 overflow-hidden relative` → `absolute inset-0 h-full` → `<Editor height="100%" />`
- Result: Monaco renders at full available height (e.g., 657px vs 5px broken state)

**Why This Works**:
- `flex-1`: Takes available vertical space in flex container
- `overflow-hidden relative`: Creates positioning context
- `absolute inset-0`: Stretches to parent bounds
- `h-full`: Explicitly sets height to 100% of parent
- Monaco `height="100%"`: Now has explicit height reference

## Best Practices (P1S1 & P5S1 Patterns)

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

## P5S1 Specific Patterns

### Dynamic Import with SSR Safety
- ✅ Use `dynamic()` from next/dynamic
- ✅ Set `ssr: false` for window/document dependent code
- ✅ Provide loading component (EditorSkeleton)
- ✅ Don't access window/document in module scope

### Monaco Theme Integration
- ✅ Define theme in `beforeMount` hook
- ✅ Match design system colors exactly
- ✅ Use CSS variable mappings for consistency
- ✅ Set cursor and selection colors for visibility

### Component Props Interface
- ✅ Document all props with JSDoc comments
- ✅ Provide sensible defaults (height: 500px, language: javascript)
- ✅ Support Monaco callback types (OnMount, BeforeMount)
- ✅ Allow custom className and options

### Loading States
- ✅ EditorSkeleton shows during Monaco initialization
- ✅ Pulse animation provides visual feedback
- ✅ Automatic with dynamic import loading prop

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

## Common Patterns in Project (P1S1 & P5S1)

### Monaco Editor Integration (P5S1)
```typescript
// Dynamic import for SSR safety
const Editor = dynamic(() => import("./Editor").then(mod => mod.Editor), {
  loading: () => <EditorSkeleton />,
  ssr: false
})

// Theme definition in beforeMount
const onBeforeMount: BeforeMount = (monaco) => {
  monaco.editor.defineTheme("boldSimplicity", {
    base: "vs-dark",
    inherit: true,
    colors: {
      "editor.background": "#0F172A",
      "editor.foreground": "#E2E8F0",
      "editorCursor.foreground": "#EC4899"
    }
  })
}

// Usage
<Editor
  value={content}
  onChange={setContent}
  language="markdown"
  height="600px"
/>
```

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
