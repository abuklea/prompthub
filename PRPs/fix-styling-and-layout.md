# PromptHub
## PRP: Fix Styling, Layout, and Authentication Error Handling

| `Title` | `Created` | `Last modified` |
|---------|-----------|-----------------|
| PRP: Fix Styling, Layout, and Authentication Error Handling | 06/11/2025 18:55 GMT+10 | 06/11/2025 18:55 GMT+10 |

## Table of Contents
- [Goal](#goal)
- [Why](#why)
- [What](#what)
- [Success Criteria](#success-criteria)
- [All Needed Context](#all-needed-context)
- [Current vs Desired State](#current-vs-desired-state)
- [Known Gotchas](#known-gotchas)
- [Implementation Blueprint](#implementation-blueprint)
- [Tasks](#tasks)
- [Validation Loop](#validation-loop)
- [Final Validation Checklist](#final-validation-checklist)
- [Anti-Patterns to Avoid](#anti-patterns-to-avoid)

---

## Goal

Transform PromptHub's current basic UI into a polished, professional application following the "Bold Simplicity" design system. Fix critical authentication error handling that currently crashes the app, and create a consistent, context-aware header component that works across all pages. The end result should be a visually cohesive application with proper error handling and user feedback.

## Why

- **User Experience**: Current auth errors cause app crashes instead of helpful error messages
- **Brand Identity**: Inconsistent styling dilutes professional appearance and user trust
- **Usability**: Missing visual feedback confuses users during form interactions
- **Professional Polish**: Default shadcn colors don't match the defined design system
- **Error Recovery**: Users can't recover from auth errors without refreshing the page

## What

A comprehensive styling and UX overhaul that includes:

1. **Style Guide Implementation**: Apply "Bold Simplicity" design system across entire app
   - Primary Indigo (#4F46E5) for main actions
   - Accent Magenta (#EC4899) for critical CTAs
   - Typography system with Inter font family
   - 4px spacing grid system
   - Dark mode first approach

2. **Auth Error Handling**: Fix server action error handling
   - Return error objects instead of throwing errors
   - Implement toast notifications for user feedback
   - Graceful error recovery without page crashes
   - Clear validation messages

3. **Context-Aware Header**: Universal header component
   - Shows user info when authenticated
   - Adapts for auth pages
   - Consistent branding across all pages
   - Navigation when needed

4. **Form Improvements**: Enhanced user feedback
   - Loading states during submission
   - Success/error toast notifications
   - Better validation messages
   - Proper redirect handling

### Success Criteria

- [ ] All pages use colors from the style guide (no default shadcn colors)
- [ ] Invalid login credentials show toast message, not app crash
- [ ] Valid login redirects to dashboard with success message
- [ ] Header appears on all pages with appropriate context
- [ ] Typography matches style guide (Inter font, correct sizes)
- [ ] All interactive elements show hover/active states
- [ ] Dark mode works correctly with style guide colors
- [ ] Build completes without errors
- [ ] Lint passes without errors

---

## All Needed Context

### Documentation & References

```yaml
# CRITICAL - Read these for implementation patterns

- file: docs/project/PromptHub_03_STYLE_01.md
  why: Complete style guide with all colors, typography, spacing rules
  critical: |
    Vibe: "Bold Simplicity" - focused, professional, modern
    Target: Power users who want efficiency without distraction
    Primary: Indigo #4F46E5
    Accent: Magenta #EC4899
    Font: Inter (400, 500, 600 weights)
    Spacing: 4px grid system

- url: https://nextjs.org/docs/app/getting-started/error-handling
  why: Next.js 14 error handling patterns for server actions
  critical: Server actions should return objects, not throw errors

- url: https://github.com/vercel/next.js/discussions/49426
  why: Official Next.js guidance on handling server action errors
  critical: Use try-catch in server actions, return { error: string } objects

- url: https://ui.shadcn.com/docs/components/form
  why: React Hook Form + shadcn/ui integration patterns
  critical: FormMessage component displays validation errors automatically

- file: src/features/auth/actions.ts
  why: Current auth actions that need error handling fixes
  critical: Currently throws errors - must return error objects instead

- file: src/features/auth/components/AuthForm.tsx
  why: Client form component that needs toast notifications
  critical: Already uses react-hook-form, just needs error handling

- file: src/components/ui/sonner.tsx
  why: Toast notification component (already installed)
  critical: Need to add Toaster to root layout and use toast() function
</yaml>

### Current Codebase Structure

```
PromptHub/
├── src/
│   ├── app/
│   │   ├── (app)/
│   │   │   ├── layout.tsx          # App layout with Header
│   │   │   ├── page.tsx            # Dashboard home
│   │   │   ├── dashboard/
│   │   │   ├── profile/
│   │   │   └── settings/
│   │   ├── (auth)/
│   │   │   ├── layout.tsx          # Auth layout
│   │   │   └── login/page.tsx     # Login page
│   │   ├── layout.tsx             # Root layout
│   │   └── auth/sign-out/route.ts
│   ├── components/
│   │   ├── layout/
│   │   │   └── Header.tsx         # Current header (basic)
│   │   ├── ui/                    # shadcn components
│   │   │   ├── button.tsx
│   │   │   ├── card.tsx
│   │   │   ├── form.tsx
│   │   │   ├── input.tsx
│   │   │   ├── sonner.tsx        # Toast component
│   │   │   └── ...
│   │   └── theme-provider.tsx
│   ├── features/
│   │   ├── auth/
│   │   │   ├── actions.ts        # NEEDS FIX: Error handling
│   │   │   ├── schemas.ts
│   │   │   └── components/
│   │   │       └── AuthForm.tsx  # NEEDS FIX: Toast integration
│   │   ├── folders/
│   │   └── prompts/
│   ├── lib/
│   │   ├── supabase/
│   │   └── utils.ts
│   ├── stores/
│   └── styles/
│       └── globals.css           # NEEDS UPDATE: CSS variables
├── tailwind.config.ts
└── package.json
```

### Desired State After Implementation

```
Changes:
1. src/styles/globals.css - Updated CSS variables for style guide colors
2. src/app/layout.tsx - Add Toaster component for notifications
3. src/features/auth/actions.ts - Return error objects, not throw
4. src/features/auth/components/AuthForm.tsx - Add toast notifications
5. src/components/layout/Header.tsx - Make context-aware and styled
6. src/app/(auth)/login/page.tsx - Apply style guide styling
7. All page components - Verify style guide compliance
```

### Style Guide Color Mapping (Hex to HSL)

```typescript
// CRITICAL: CSS variables use HSL format, not hex
// Use these exact HSL values for style guide colors

// Primary Indigo #4F46E5 = hsl(239, 84%, 67%)
// Indigo Light #6366F1 = hsl(239, 84%, 67%)
// Indigo Pale #EEF2FF = hsl(239, 100%, 97%)

// Accent Magenta #EC4899 = hsl(328, 85%, 70%)
// Accent Sky #0EA5E9 = hsl(199, 89%, 48%)

// Success Green #22C55E = hsl(142, 71%, 45%)
// Error Red #EF4444 = hsl(0, 72%, 51%)
// Warning Amber #F59E0B = hsl(38, 92%, 50%)

// Grays
// Gray 900 #111827 = hsl(220, 26%, 14%)
// Gray 800 #1F2937 = hsl(217, 19%, 27%)
// Gray 700 #374151 = hsl(217, 19%, 35%)
// Gray 500 #6B7280 = hsl(220, 9%, 46%)
// Gray 300 #D1D5DB = hsl(214, 14%, 83%)
// Gray 200 #E5E7EB = hsl(220, 13%, 91%)
// Gray 100 #F3F4F6 = hsl(220, 14%, 96%)

// Background
// Dark page: hsl(222, 47%, 11%) - #0F172A (Darker than Gray 900)
// Dark card: hsl(220, 26%, 14%) - #111827 (Gray 900)
```

### Known Gotchas & Library Quirks

```typescript
// CRITICAL: Next.js 14 Server Actions Error Handling
// ❌ WRONG - Causes unhandled runtime error in browser
export async function signIn(values: SignInSchema) {
  const { error } = await supabase.auth.signInWithPassword(values)
  if (error) {
    throw error  // ❌ This crashes the app!
  }
  redirect("/dashboard")
}

// ✅ CORRECT - Returns error object for client handling
export async function signIn(values: SignInSchema) {
  try {
    const { error } = await supabase.auth.signInWithPassword(values)
    if (error) {
      return { success: false, error: error.message }
    }
    revalidatePath("/", "layout")
    redirect("/dashboard")
  } catch (error) {
    return { success: false, error: "An unexpected error occurred" }
  }
}

// CRITICAL: Redirect in server actions
// redirect() throws a NEXT_REDIRECT error internally - this is expected!
// Wrap entire function in try-catch to handle both errors and redirects

// CRITICAL: Sonner Toast Usage
// 1. Add <Toaster /> to root layout (only once)
// 2. Import { toast } from "sonner" in client components
// 3. Call toast.error() or toast.success() with message

// CRITICAL: CSS Variables
// - Use HSL format: hsl(239, 84%, 67%) not #4F46E5
// - Update both :root and .dark selectors
// - Test dark mode after changes

// CRITICAL: React Hook Form with Server Actions
// - Use form.handleSubmit(onSubmit) wrapper
// - Check returned object for success/error
// - Display errors with toast, not FormMessage (for server errors)
// - FormMessage shows validation errors only

// CRITICAL: Inter Font
// - Already available via next/font/google if imported
// - Add to layout.tsx and apply to body
// - Weights needed: 400 (regular), 500 (medium), 600 (semibold)
```

---

## Implementation Blueprint

### Phase 1: Fix Critical Auth Error Handling

The current auth flow crashes on errors because server actions throw exceptions instead of returning error objects. Fix this first before styling changes.

```typescript
// File: src/features/auth/actions.ts
// PATTERN: Return objects, wrap in try-catch, handle redirects

"use server"

import { createClient } from "@/lib/supabase/server"
import { SignUpSchema, SignInSchema } from "./schemas"
import { z } from "zod"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

type ActionResult = {
  success: boolean
  error?: string
}

export async function signUp(values: z.infer<typeof SignUpSchema>): Promise<ActionResult> {
  try {
    const supabase = createClient()
    const { data, error } = await supabase.auth.signUp(values)

    if (error) {
      return { success: false, error: error.message }
    }

    revalidatePath("/", "layout")
    redirect("/dashboard") // This throws NEXT_REDIRECT - expected!
  } catch (error) {
    // Catch both auth errors and other unexpected errors
    if (error instanceof Error && error.message === "NEXT_REDIRECT") {
      throw error // Re-throw redirect
    }
    return { success: false, error: "An unexpected error occurred" }
  }
}

export async function signIn(values: z.infer<typeof SignInSchema>): Promise<ActionResult> {
  try {
    const supabase = createClient()
    const { data, error } = await supabase.auth.signInWithPassword(values)

    if (error) {
      return { success: false, error: error.message }
    }

    revalidatePath("/", "layout")
    redirect("/dashboard")
  } catch (error) {
    if (error instanceof Error && error.message === "NEXT_REDIRECT") {
      throw error
    }
    return { success: false, error: "An unexpected error occurred" }
  }
}

// signOut stays the same - errors here are less critical
```

### Phase 2: Add Toast Notifications to Forms

```typescript
// File: src/features/auth/components/AuthForm.tsx
// PATTERN: Import toast, check result, show feedback

"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner" // ADD THIS
// ... other imports

export function AuthForm() {
  const [isSignIn, setIsSignIn] = useState(true)
  const [isLoading, setIsLoading] = useState(false) // ADD loading state

  const form = useForm<z.infer<typeof SignInSchema> & Partial<z.infer<typeof SignUpSchema>>>({
    resolver: zodResolver(isSignIn ? SignInSchema : SignUpSchema) as any,
    defaultValues: {
      email: "",
      password: "",
      confirmPassword: "",
    },
  })

  const onSubmit = async (values: z.infer<typeof SignInSchema> | z.infer<typeof SignUpSchema>) => {
    setIsLoading(true)

    try {
      let result
      if (isSignIn) {
        result = await signIn(values as z.infer<typeof SignInSchema>)
      } else {
        result = await signUp(values as z.infer<typeof SignUpSchema>)
      }

      // Check if we got an error back
      if (result && !result.success) {
        toast.error(result.error || "An error occurred")
        setIsLoading(false)
        return
      }

      // Success - redirect will happen from server action
      toast.success(isSignIn ? "Welcome back!" : "Account created!")

    } catch (error) {
      // Unexpected client-side errors
      toast.error("An unexpected error occurred")
      setIsLoading(false)
    }
  }

  return (
    <Card className="w-[350px]">
      {/* ... existing JSX ... */}
      <Button
        className="w-full"
        type="submit"
        disabled={isLoading}
      >
        {isLoading ? "Loading..." : (isSignIn ? "Sign In" : "Create Account")}
      </Button>
      {/* ... rest of form ... */}
    </Card>
  )
}
```

### Phase 3: Update CSS Variables for Style Guide

```css
/* File: src/styles/globals.css */
/* PATTERN: Convert hex colors to HSL, update both :root and .dark */

@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    /* Light mode - PromptHub Style Guide */
    --background: 220 14% 96%;              /* Gray 100 #F3F4F6 */
    --foreground: 220 26% 14%;              /* Gray 900 #111827 */

    --card: 0 0% 100%;                       /* White */
    --card-foreground: 220 26% 14%;         /* Gray 900 */

    --popover: 0 0% 100%;
    --popover-foreground: 220 26% 14%;

    --primary: 239 84% 67%;                 /* Primary Indigo #4F46E5 */
    --primary-foreground: 0 0% 100%;        /* White */

    --secondary: 217 19% 35%;               /* Gray 700 */
    --secondary-foreground: 0 0% 100%;

    --muted: 220 14% 96%;                   /* Gray 100 */
    --muted-foreground: 220 9% 46%;         /* Gray 500 */

    --accent: 328 85% 70%;                  /* Accent Magenta #EC4899 */
    --accent-foreground: 0 0% 100%;

    --destructive: 0 72% 51%;               /* Error Red #EF4444 */
    --destructive-foreground: 0 0% 100%;

    --border: 220 13% 91%;                  /* Gray 200 */
    --input: 214 14% 83%;                   /* Gray 300 */
    --ring: 239 84% 67%;                    /* Primary Indigo */

    --radius: 0.375rem;                     /* 6px */
  }

  .dark {
    /* Dark mode - PromptHub Style Guide (Dark Mode First) */
    --background: 222 47% 11%;              /* Darker than Gray 900 #0F172A */
    --foreground: 0 0% 100%;                /* White */

    --card: 220 26% 14%;                    /* Gray 900 #111827 */
    --card-foreground: 0 0% 100%;

    --popover: 220 26% 14%;
    --popover-foreground: 0 0% 100%;

    --primary: 239 84% 67%;                 /* Primary Indigo #4F46E5 */
    --primary-foreground: 0 0% 100%;

    --secondary: 217 19% 27%;               /* Gray 800 #1F2937 */
    --secondary-foreground: 0 0% 100%;

    --muted: 217 19% 27%;                   /* Gray 800 */
    --muted-foreground: 220 9% 46%;         /* Gray 500 */

    --accent: 328 85% 70%;                  /* Accent Magenta #EC4899 */
    --accent-foreground: 0 0% 100%;

    --destructive: 0 72% 51%;               /* Error Red #EF4444 */
    --destructive-foreground: 0 0% 100%;

    --border: 217 19% 27%;                  /* Gray 800 */
    --input: 217 19% 27%;                   /* Gray 800 */
    --ring: 239 84% 67%;                    /* Primary Indigo */
  }
}

@layer base {
  * {
    @apply border-border;
  }
  body {
    @apply bg-background text-foreground;
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  }
}
```

### Phase 4: Add Toaster to Root Layout

```typescript
// File: src/app/layout.tsx
// PATTERN: Add Toaster component once at root

import { Toaster } from "@/components/ui/sonner" // ADD THIS
import { Inter } from "next/font/google" // ADD THIS

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-inter',
})

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster position="top-right" /> {/* ADD THIS */}
        </ThemeProvider>
      </body>
    </html>
  )
}
```

### Phase 5: Create Context-Aware Header

```typescript
// File: src/components/layout/Header.tsx
// PATTERN: Conditional rendering based on user state

"use client"

import { Button } from "@/components/ui/button"
import { signOut } from "@/features/auth/actions"
import Link from "next/link"
import { User } from "@supabase/supabase-js"

interface HeaderProps {
  user?: User | null
}

export function Header({ user }: HeaderProps) {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-card/80 backdrop-blur supports-[backdrop-filter]:bg-card/60">
      <div className="container flex h-16 items-center justify-between px-4">
        <div className="flex items-center gap-6">
          <Link href={user ? "/dashboard" : "/"}>
            <h1 className="font-extrabold tracking-tighter text-2xl">
              PromptHub
            </h1>
          </Link>

          {user && (
            <nav className="hidden md:flex items-center gap-4">
              <Link href="/dashboard">
                <Button variant="ghost" size="sm">Dashboard</Button>
              </Link>
              <Link href="/profile">
                <Button variant="ghost" size="sm">Profile</Button>
              </Link>
              <Link href="/settings">
                <Button variant="ghost" size="sm">Settings</Button>
              </Link>
            </nav>
          )}
        </div>

        <div className="flex items-center gap-4">
          {user ? (
            <>
              <span className="hidden sm:inline text-sm text-muted-foreground">
                {user.email}
              </span>
              <form action={signOut}>
                <Button variant="outline" size="sm">Sign Out</Button>
              </form>
            </>
          ) : (
            <Link href="/login">
              <Button size="sm">Sign In</Button>
            </Link>
          )}
        </div>
      </div>
    </header>
  )
}
```

### Phase 6: Update Auth Pages Styling

```typescript
// File: src/app/(auth)/login/page.tsx
// PATTERN: Apply style guide spacing and layout

import { AuthForm } from "@/features/auth/components/AuthForm"

export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <div className="mb-8 text-center">
        <h1 className="font-extrabold tracking-tighter text-2xl mb-2">
          PromptHub
        </h1>
        <p className="text-sm text-muted-foreground">
          Your centralized AI prompt repository
        </p>
      </div>
      <AuthForm />
    </div>
  )
}
```

---

## Tasks

Complete these tasks in order. Each task builds on the previous one.

### Task 1: Update CSS Variables for Style Guide Colors

**Objective**: Replace default shadcn colors with PromptHub style guide colors

**Actions**:
- MODIFY `src/styles/globals.css`
- REPLACE all CSS variables in `:root` selector with style guide HSL values
- REPLACE all CSS variables in `.dark` selector with style guide HSL values
- ADD Inter font family to body styles
- PRESERVE @tailwind directives and @layer structure

**Validation**:
```bash
# Visual check - reload browser and verify colors changed
# Primary buttons should be Indigo, not default
```

### Task 2: Add Inter Font to Root Layout

**Objective**: Apply Inter font family across application

**Actions**:
- MODIFY `src/app/layout.tsx`
- IMPORT Inter from 'next/font/google'
- CONFIGURE font with weights [400, 500, 600]
- APPLY font variable to html className
- PRESERVE existing ThemeProvider and structure

**Validation**:
```bash
npm run build
# Check for font loading errors
```

### Task 3: Fix Server Action Error Handling

**Objective**: Prevent app crashes by returning error objects instead of throwing

**Actions**:
- MODIFY `src/features/auth/actions.ts`
- WRAP signIn function in try-catch
- RETURN `{ success: false, error: string }` instead of throwing
- HANDLE NEXT_REDIRECT by re-throwing
- APPLY same pattern to signUp function
- ADD ActionResult type definition
- PRESERVE signOut function (no changes needed)

**Validation**:
```bash
npm run lint
# Should pass without errors
```

### Task 4: Add Toaster Component to Root Layout

**Objective**: Enable toast notifications throughout app

**Actions**:
- MODIFY `src/app/layout.tsx`
- IMPORT Toaster from "@/components/ui/sonner"
- ADD `<Toaster position="top-right" />` before closing body tag
- PLACE after {children} and inside ThemeProvider
- VERIFY only one Toaster instance exists

**Validation**:
```bash
npm run build
# Should build successfully
```

### Task 5: Add Toast Notifications to AuthForm

**Objective**: Show user-friendly error messages instead of crashes

**Actions**:
- MODIFY `src/features/auth/components/AuthForm.tsx`
- IMPORT { toast } from "sonner"
- ADD isLoading state to track submission
- WRAP signIn/signUp calls in try-catch
- CHECK result object for success/error
- CALL toast.error() for errors
- CALL toast.success() for success
- ADD disabled state to button during loading
- UPDATE button text to show loading state

**Validation**:
```bash
# Manual test - try invalid login credentials
# Should show toast, NOT crash app
curl http://localhost:3010/login
# Page should load without errors
```

### Task 6: Create Context-Aware Header Component

**Objective**: Build universal header that adapts to user state

**Actions**:
- MODIFY `src/components/layout/Header.tsx`
- ACCEPT optional user prop
- ADD sticky positioning with backdrop blur
- SHOW brand name with link (to dashboard if logged in, / if not)
- ADD navigation menu for authenticated users (Dashboard, Profile, Settings)
- SHOW user email and sign out button when authenticated
- SHOW sign in button when not authenticated
- USE style guide spacing (h-16 header height)
- APPLY proper typography (font-extrabold tracking-tighter text-2xl)

**Validation**:
```bash
npm run lint
# Should pass
```

### Task 7: Update App Layout to Use New Header

**Objective**: Ensure header appears on all authenticated pages

**Actions**:
- VERIFY `src/app/(app)/layout.tsx` uses Header component
- CONFIRM user prop is passed correctly
- VERIFY header appears above sidebar/content
- NO changes needed if already correct

**Validation**:
```bash
# Visual check - header should appear on dashboard
```

### Task 8: Update Auth Pages Styling

**Objective**: Apply style guide to login page

**Actions**:
- MODIFY `src/app/(auth)/login/page.tsx`
- ADD branding header above form
- USE style guide spacing and typography
- CENTER content vertically and horizontally
- APPLY proper background color

**Validation**:
```bash
# Visual check - login page should match style guide
http://localhost:3010/login
```

### Task 9: Verify Style Guide Compliance

**Objective**: Ensure all components use correct colors and typography

**Actions**:
- REVIEW all pages for color compliance
- CHECK button colors (primary should be Indigo)
- VERIFY typography sizes and weights
- TEST hover states on interactive elements
- VERIFY dark mode works correctly

**Validation**:
```bash
# Visual inspection checklist:
# - Primary buttons: Indigo #4F46E5
# - Card backgrounds: Gray 900 in dark, White in light
# - Typography: Inter font, correct sizes
# - Spacing: 4px grid (gaps should be 4, 8, 12, 16, 24, 32)
```

### Task 10: End-to-End Testing

**Objective**: Verify complete auth flow works with new error handling

**Actions**:
- TEST invalid login (wrong password)
- TEST invalid email format
- TEST valid login
- TEST sign up flow
- TEST sign out flow
- VERIFY toasts appear for all scenarios
- VERIFY no console errors
- VERIFY redirects work correctly

**Validation**:
```bash
npm run build && npm run start
# Test complete auth flow on production build
```

---

## Validation Loop

### Level 1: Syntax & Type Checking

```bash
# Run FIRST - fix any errors before proceeding
npm run lint

# Expected: No errors
# If errors: Read message, fix issue, re-run
```

### Level 2: Build Validation

```bash
# Ensure app builds successfully
npm run build

# Expected: Build completes without errors
# If failing: Check error message, fix, rebuild
```

### Level 3: Manual Testing - Error Scenarios

**Test Invalid Login:**
```bash
# Start dev server if not running
npm run dev

# Navigate to http://localhost:3010/login
# Enter email: test@example.com
# Enter password: wrongpassword
# Click Sign In

# Expected:
# - Toast appears with error message
# - App does NOT crash
# - User can try again
# - Form stays on login page

# If failing: Check browser console for errors
```

**Test Valid Login:**
```bash
# Use test credentials: allan@formationmedia.net / *.Password123
# Enter credentials
# Click Sign In

# Expected:
# - Success toast appears
# - Redirect to /dashboard
# - No console errors

# If failing: Check network tab for auth response
```

### Level 4: Visual Style Guide Compliance

**Color Check:**
```bash
# Open browser dev tools (F12)
# Inspect primary button
# Expected computed styles:
# - background-color: rgb(79, 70, 229) [Indigo]
# - Hover: rgb(99, 102, 241) [Indigo Light]

# Inspect card
# Expected (dark mode):
# - background-color: rgb(17, 24, 39) [Gray 900]

# If wrong colors: CSS variables not applied correctly
```

**Typography Check:**
```bash
# Inspect brand heading "PromptHub"
# Expected computed styles:
# - font-family: Inter, sans-serif
# - font-size: 1.5rem (24px)
# - font-weight: 800
# - letter-spacing: -0.05em

# If wrong: Font not loaded or CSS not applied
```

### Level 5: Dark Mode Toggle

```bash
# Use theme toggle (if available) or browser dev tools
# Change between light and dark modes

# Expected:
# - Colors transition smoothly
# - All elements remain visible
# - Contrast is good in both modes

# If failing: Check .dark CSS variables
```

---

## Final Validation Checklist

Before marking tasks complete, verify:

- [ ] `npm run lint` passes without errors
- [ ] `npm run build` completes successfully
- [ ] Invalid login shows toast error (not crash)
- [ ] Valid login redirects to dashboard with success toast
- [ ] Header appears on all pages with correct user state
- [ ] Primary buttons use Indigo color (#4F46E5)
- [ ] Cards use correct background colors (Gray 900 dark, White light)
- [ ] Inter font is applied throughout app
- [ ] Spacing follows 4px grid system
- [ ] Dark mode works correctly
- [ ] All interactive elements show hover states
- [ ] No console errors during auth flow
- [ ] Browser doesn't crash on auth errors
- [ ] Form shows loading state during submission

---

## Anti-Patterns to Avoid

- ❌ Don't throw errors from server actions - return error objects
- ❌ Don't use hex colors directly - use CSS variables
- ❌ Don't add multiple Toaster components - only one in root layout
- ❌ Don't catch redirect errors - re-throw them
- ❌ Don't skip loading states - users need feedback
- ❌ Don't hardcode colors - use Tailwind classes with CSS variables
- ❌ Don't ignore TypeScript errors - fix them
- ❌ Don't skip manual testing - automated tests don't catch visual issues
- ❌ Don't forget to test dark mode - it's the default
- ❌ Don't use console.log for errors - use toast notifications

---

## Integration with magic21st Tools

When implementing UI components, use magic21st tools with this comprehensive context:

**Design Brief for magic21st:**
```
Project: PromptHub - AI Prompt Management Application

Design System: "Bold Simplicity"
Vibe: Focused, professional, modern. A high-quality tool for power users.
Target Audience: Developers and power users who value efficiency and clarity.

Color Palette:
- Primary: Indigo #4F46E5 (main actions, active states)
- Primary Light: #6366F1 (hover states)
- Accent: Magenta #EC4899 (critical CTAs, highlights)
- Success: Green #22C55E
- Error: Red #EF4444
- Background Dark: #0F172A (page background)
- Card Dark: #111827 (component backgrounds)
- Text: White on dark, Gray 900 on light

Typography:
- Font: Inter (weights 400, 500, 600)
- H1: 24px/32px, Semibold, -0.02em
- H2: 20px/28px, Semibold, -0.02em
- Body: 14px/20px, Regular
- Button: 14px/20px, Medium

Spacing: 4px grid system (4, 8, 12, 16, 24, 32, 48)

Components:
- Buttons: 40px height, 6px radius, 16px padding
- Cards: 8px radius, 16-24px padding, 1px Gray 800 border
- Inputs: 40px height, 6px radius, Gray 800 background

Feel: Clean, uncluttered, immediate feedback, smooth animations (200ms)
```

---

## PRP Confidence Score: 9/10

**Reasoning:**
- ✅ Complete error handling solution with examples
- ✅ All necessary context included (style guide, patterns, gotchas)
- ✅ Executable validation gates at each level
- ✅ Step-by-step tasks with clear objectives
- ✅ References to existing patterns in codebase
- ✅ Critical gotchas documented (redirects, toast, CSS variables)
- ✅ Visual validation checklist for style compliance
- ⚠️ May need minor adjustments for edge cases (0.5 point deduction)
- ⚠️ magic21st integration untested in this context (0.5 point deduction)

**Expected Outcome:** One-pass implementation with minor iterations during validation phases.

---

**PRP Status**: READY FOR IMPLEMENTATION
**PRP ID**: P1S1
**Archon Project**: PromptHub (d449f266-1f36-47ad-bd2d-30f1a0f5e999)
**Tasks**: 10 tasks (P1S1T1 - P1S1T10)
**Phase**: Phase 1 - UI/UX Foundation
**Dependencies**: None
**Estimated Implementation Time (FTE)**: 4-6 hours

**Recommendations:**
Agents:
- `senior-frontend-engineer` (Tasks 1-10)

Notes:
- Task 3 (error handling) is critical - must be completed before Task 5
- Test incrementally after each task
- Visual validation requires manual inspection
- Use test user: allan@formationmedia.net / *.Password123
