# PromptHub - Technical Specifications

## 1. Executive Summary
- **Project Overview and Objectives:** PromptHub is a centralized web application designed for AI developers, researchers, and content creators to efficiently store, organize, version, and manage their AI prompts. The primary objective is to provide a secure, high-performance, and intuitive "GitHub for prompts," featuring a nested folder structure, robust search, a rich text editor with version control, and a comprehensive tagging system.
- **Key Technical Decisions and Rationale:**
    - **Framework:** Next.js with the App Router is chosen for its performance, hybrid rendering capabilities (Server and Client Components), and integrated backend logic via Server Actions.
    - **Backend Logic:** Next.js Server Actions will be the exclusive method for all backend logic, co-locating mutations and queries with the components that use them, simplifying the architecture and eliminating the need for a separate API layer.
    - **Database & Auth:** Supabase is selected for its integrated solution, providing a managed Postgres database, a robust authentication system, and powerful Row Level Security (RLS) for data isolation.
    - **ORM & Validation:** Prisma will serve as the type-safe ORM to interact with the database, while Zod will enforce strict data validation on all Server Action inputs, ensuring data integrity.
    - **UI & Theming:** `shadcn/ui` provides a foundation of unstyled, accessible components, which will be styled using Tailwind CSS. Theming is managed via CSS variables, allowing for easy customization and dark/light mode implementation.
    - **State Management:** Zustand is chosen for client-side global state management due to its simplicity, minimal boilerplate, and performance. It will manage UI state like folder tree expansion and the currently active prompt.
- **High-Level Architecture Diagram:**
    ```mermaid
    graph TD
        subgraph Browser
            A[Next.js Frontend - React]
            A1[shadcn/ui & Framer Motion]
            A2[Monaco Editor]
            A3[Zustand Store]
        end

        subgraph Vercel
            B[Next.js Server]
            C[Server Actions w/ Zod]
        end

        subgraph "Cloud Service (Supabase)"
            E[Supabase Auth]
            F[Postgres Database w/ RLS]
        end

        subgraph "Database Schema (in Postgres)"
            H[Profiles]
            I[Folders]
            J[Prompts]
            K[Tags & _PromptToTag]
            L[PromptVersions]
            M[FTS Index (GIN)]
        end

        A -- "Uses" --> A1 & A2
        A -- "Manages UI State with" --> A3
        A -- "Invokes" --> C
        B -- "Serves Pages" --> A
        C -- "Uses Prisma Client" --> F
        A -- "Authenticates via" --> E
        C -- "Validates User Session" --> E

        F -- "Contains" --> H & I & J & K & L & M
        H -- "1-to-many" --> J
        H -- "1-to-many" --> I
        I -- "Self-ref (1-to-many)" --> I
        I -- "1-to-many" --> J
        J -- "many-to-many" --> K
        J -- "1-to-many" --> L
        J -- "Updates" --> M

        classDef fe fill:#D5F5E3,stroke:#333,stroke-width:2px;
        classDef services fill:#D6EAF8,stroke:#333,stroke-width:2px;
        classDef db fill:#E8DAEF,stroke:#333,stroke-width:2px;

        class A,B,C,A1,A2,A3 fe
        class E,F services
        class H,I,J,K,L,M db
    ```- **Technology Stack Recommendations:**
    - **Frontend:** Next.js 14+ (App Router), React 18+, TypeScript, Tailwind CSS
    - **UI Components:** shadcn/ui
    - **Animation:** Framer Motion
    - **Client State:** Zustand
    - **Backend:** Next.js Server Actions
    - **Database:** Supabase (Postgres 15+)
    - **ORM:** Prisma
    - **Validation:** Zod
    - **Editor:** Monaco Editor (via `@monaco-editor/react`)
    - **Testing:** Vitest (Unit/Integration), Playwright (End-to-End)
    - **Deployment:** Vercel

## 2. System Architecture

### 2.1 Architecture Overview
- **System Components:**
    - **Next.js Frontend:** A client-side application built with React and `shadcn/ui` components. It handles all rendering, user interactions, and manages UI state with Zustand. It communicates with the backend exclusively through Server Actions.
    - **Next.js Backend (Server Actions):** A serverless backend co-located within the Next.js application. Server Actions, protected by Supabase Auth middleware, handle all business logic, data validation (Zod), and database communication (Prisma).
    - **Supabase:** A managed cloud service providing the core data persistence layer (Postgres), user authentication, and authorization via Row Level Security.
- **Data Flow Diagrams:**
    - **Read Operation (e.g., Fetching Prompts):**
        1.  User clicks a folder in the React client.
        2.  The client component invokes a Server Action, e.g., `getPromptsByFolder(folderId)`.
        3.  The Server Action validates the user's session.
        4.  Prisma client queries the Supabase DB for prompts where `folder_id` matches and `user_id` matches the authenticated user's ID (enforced by RLS).
        5.  Data is returned to the client component and rendered.
    - **Write Operation (e.g., Creating a Folder):**
        1.  User submits a "New Folder" form.
        2.  A Server Action, e.g., `createFolder(data)`, is invoked.
        3.  Zod validates the input `data` schema.
        4.  Prisma client executes an `INSERT` command into the `Folders` table.
        5.  The Server Action calls `revalidateTag('folders')` to invalidate the client-side cache.
        6.  The client UI automatically re-fetches the updated folder list.
- **Project Structure:** A feature-based organization will be used within the `src` directory to promote modularity and scalability.
    ```
    /src
    ├── app/                  # Next.js App Router (routing files)
    │   ├── (auth)/           # Route group for auth pages
    │   │   ├── login/
    │   │   └── layout.tsx
    │   ├── (app)/            # Route group for the main application
    │   │   ├── layout.tsx    # Main 3-pane layout
    │   │   └── page.tsx      # Default page for the app
    │   ├── api/              # API routes if needed (e.g., webhooks)
    │   └── layout.tsx        # Root layout
    ├── features/             # Feature-based modules
    │   ├── auth/
    │   │   ├── components/   # SignInForm.tsx, SignUpForm.tsx
    │   │   └── actions.ts    # signIn, signUp server actions
    │   ├── folders/
    │   │   ├── components/   # FolderTree.tsx, FolderItem.tsx
    │   │   ├── actions.ts    # createFolder, moveFolder server actions
    │   │   └── store.ts      # Zustand store for folder tree state
    │   └── editor/
    │       ├── components/   # EditorPane.tsx, VersionHistory.tsx
    │       ├── actions.ts    # savePromptVersion server action
    │       └── ...
    ├── components/           # Shared, primitive UI components (from shadcn/ui)
    │   └── ui/               # Button.tsx, Card.tsx, etc.
    ├── lib/                  # Shared libraries and utilities
    │   ├── db.ts             # Prisma client instance
    │   ├── supabase.ts       # Supabase client instance
    │   └── utils.ts          # General utility functions
    ├── styles/
    │   └── globals.css       # Global styles and Tailwind directives
    └── types/                # Shared TypeScript types
    ```

### 2.2 Technology Stack
- **Frontend:**
    - **Next.js (App Router):** Core framework for server-side rendering, static site generation, and routing.
    - **React:** UI library for building components.
    - **TypeScript:** For static typing and improved developer experience.
    - **shadcn/ui:** Component library providing unstyled, accessible primitives for building the custom design system.
    - **Tailwind CSS:** Utility-first CSS framework for styling.
    - **Framer Motion:** Animation library for fluid UI transitions and microinteractions.
    - **Zustand:** Minimalist client-side state management for global UI state.
    - **Monaco Editor:** VS Code's editor component for a rich prompt editing experience.
- **Backend:**
    - **Next.js Server Actions:** For all server-side logic, data fetching, and mutations.
    - **Zod:** For schema declaration and validation of all inputs to Server Actions.
- **Database and Services:**
    - **Supabase (Postgres):** Primary relational database.
    - **Supabase Auth:** For user authentication (email/password) and session management.
    - **Prisma:** Type-safe ORM for interacting with the Postgres database.
- **Deployment & DevOps:**
    - **Vercel:** Hosting platform with seamless CI/CD integration for Next.js.
    - **Vitest:** Testing framework for unit and integration tests of Server Actions and utilities.
    - **Playwright:** End-to-end testing framework for critical user flows.

## 3. Feature Specifications

### 3.1 Authentication & User Management
- **User Stories:**
    - As a new user, I want to sign up with my email and password.
    - As a returning user, I want to log in to access my prompts.
    - As a user, I want a simple profile page to update my display name.
    - As a user, I want to reset my password if I forget it.
- **Technical Requirements:**
    - Use `@supabase/ssr` library for server-side auth handling.
    - Implement protected routes using Next.js middleware.
    - Create a trigger in Supabase to automatically create a `Profiles` entry upon user sign-up.
    - The UI must handle default, loading, and error states as defined in the UI/UX guide.
- **Implementation Approach:**
    1.  **Sign-Up/Login UI:** Create a client component `AuthForm.tsx` that toggles between Sign In and Sign Up views.
    2.  **Server Actions:**
        -   `signUp(formData)`: Calls Supabase's `signUp` method.
        -   `signIn(formData)`: Calls Supabase's `signInWithPassword` method.
        -   `signOut()`: Calls Supabase's `signOut` method.
        -   `sendPasswordReset(email)`: Calls Supabase's `resetPasswordForEmail`.
    3.  **Middleware:** `src/middleware.ts` will use `createMiddlewareClient` from `@supabase/ssr` to protect routes under the `(app)` group and refresh user sessions.
    4.  **Profile Management:** A simple form on a `/profile` page will call a Server Action `updateProfile(formData)` which uses Prisma to update the `display_name` in the `Profiles` table.
- **API (Server Actions):**
    - `signUp(payload: z.infer<typeof SignUpSchema>): Promise<...>`
    - `signIn(payload: z.infer<typeof SignInSchema>): Promise<...>`
    - `signOut(): Promise<void>`
    - `updateProfile(payload: z.infer<typeof ProfileSchema>): Promise<...>`
- **Data Models Involved:** `Profiles`, `auth.users` (Supabase).
- **Error Handling:** Zod schemas will validate form data. Supabase auth errors will be caught and returned to the client component to be displayed as an error message below the form.

### 3.2 Prompt Organization & Retrieval
- **User Stories:**
    - I want to create a nested folder structure.
    - I want to drag and drop prompts and folders to reorganize them.
    - I want to perform a full-text search across all my prompts.
    - I want the folder structure to load quickly (lazy-loading).
- **Technical Requirements:**
    - The folder hierarchy must be lazy-loaded. Only root folders are fetched initially. Subfolders are fetched on-demand.
    - Drag-and-drop operations must use pessimistic UI updates. The UI change is only committed after server confirmation.
    - Full-text search must be performant, utilizing a GIN index on a `tsvector` column in the database.
- **Implementation Approach:**
    1.  **Folder Tree:** The `FolderTree.tsx` component will fetch initial root folders (`parentId` is `NULL`). Each `FolderItem.tsx` with children will have a disclosure triangle. Clicking it will invoke a Server Action `getFoldersByParentId(parentId)` and render the children.
    2.  **State Management:** A Zustand store will manage the expanded/collapsed state of folders in the tree.
    3.  **Drag and Drop:** A library like `dnd-kit` will be used. On drop, a Server Action `moveItem(itemId, targetFolderId)` is called. The client UI will show a loading state on the dragged item until the action completes.
    4.  **Full-Text Search:** An input field will trigger a Server Action `searchPrompts(query)` on change (with debouncing). This action will use Prisma's raw query capabilities to search against the `content_tsv` column.
- **API (Server Actions):**
    - `getFoldersByParentId(parentId: string | null): Promise<Folder[]>`
    - `createFolder(name: string, parentId: string | null): Promise<Folder>`
    - `moveItem(itemId: string, itemType: 'prompt' | 'folder', targetFolderId: string | null): Promise<{ success: boolean }>`
    - `searchPrompts(query: string): Promise<Prompt[]>`
- **Data Models Involved:** `Folders`, `Prompts`.
- **Error Handling:** Network errors during lazy-loading or search will display a toast notification. Failed drag-and-drop operations will revert the item to its original position and show an error toast.

### 3.3 Prompt Editor & Version Control
- **User Stories:**
    - I want a powerful editor with syntax highlighting.
    - I want my work auto-saved locally so I don't lose it.
    - I want to view a history of all saved changes.
    - I want a side-by-side "diff" view to compare two versions.
- **Technical Requirements:**
    - Integrate the Monaco Editor for the editing experience.
    - Implement auto-saving of the current draft to the browser's `localStorage`.
    - When a user manually saves, a new version must be created by calculating a diff from the previous version.
    - The diff view must be implemented using Monaco Editor's built-in diffing capabilities.
- **Implementation Approach:**
    1.  **Editor Component:** Create an `Editor.tsx` component that dynamically imports `@monaco-editor/react` to avoid SSR issues.
    2.  **Auto-Saving:** Use a `useEffect` hook with debouncing to save the editor's content to `localStorage` under a key like `draft-prompt-${promptId}`.
    3.  **Manual Save:** The "Save" button will call a Server Action `saveNewVersion(promptId, newContent)`.
        -   This action fetches the latest `content` from the `Prompts` table.
        -   It uses a library like `diff-match-patch` to compute the diff between the old and new content.
        -   It creates a new entry in `PromptVersions` with the `diff`.
        -   It updates the `content` and `updated_at` fields in the `Prompts` table.
    4.  **Version History:** A "History" button opens a panel that lists all `PromptVersions` for the current prompt.
    5.  **Diff View:** Selecting two versions from the history panel will switch the Monaco editor into its diff mode, feeding it the content of the two versions (reconstructed by applying patches).
- **API (Server Actions):**
    - `getPromptDetails(promptId: string): Promise<Prompt & { versions: PromptVersion[] }>`
    - `saveNewVersion(promptId: string, newContent: string): Promise<{ success: boolean }>`
    - `revertToVersion(promptId: string, versionId: number): Promise<{ success: boolean }>`
- **Data Models Involved:** `Prompts`, `PromptVersions`.

## 4. Data Architecture

### 4.1 Data Models
The database schema will be defined using Prisma Schema Language (`schema.prisma`).

```prisma
// schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}

model Profile {
  id          String    @id @default(uuid())
  display_name String?
  created_at  DateTime  @default(now())
  user_id     String    @unique // Corresponds to Supabase auth.users.id
  
  folders     Folder[]
  prompts     Prompt[]
}

model Folder {
  id         String    @id @default(uuid())
  name       String
  created_at DateTime  @default(now())

  user_id    String
  user       Profile   @relation(fields: [user_id], references: [id], onDelete: Cascade)

  parent_id  String?
  parent     Folder?   @relation("NestedFolders", fields: [parent_id], references: [id], onDelete: Restrict)
  children   Folder[]  @relation("NestedFolders")

  prompts    Prompt[]

  @@index([user_id, parent_id])
}

model Prompt {
  id          String    @id @default(uuid())
  title       String
  content     String
  content_tsv Unsupported("tsvector")? // For Full-Text Search
  created_at  DateTime  @default(now())
  updated_at  DateTime  @updatedAt

  user_id     String
  user        Profile   @relation(fields: [user_id], references: [id], onDelete: Cascade)

  folder_id   String?
  folder      Folder?   @relation(fields: [folder_id], references: [id], onDelete: SetNull)

  versions    PromptVersion[]
  tags        Tag[]

  @@index([user_id, folder_id])
  @@index([content_tsv], type: Gin)
}

model PromptVersion {
  id         Int       @id @default(autoincrement())
  diff       String    // Stores the patch from diff-match-patch
  created_at DateTime  @default(now())

  prompt_id  String
  prompt     Prompt    @relation(fields: [prompt_id], references: [id], onDelete: Cascade)

  @@index([prompt_id])
}

model Tag {
  id      String   @id @default(uuid())
  name    String   @unique
  user_id String   // To scope tags per user
  
  prompts Prompt[]

  @@index([user_id])
}
```

### 4.2 Data Storage
- **Database:** Supabase managed Postgres database.
- **Data Persistence:** All application data will be persisted in the Postgres database via Prisma. Local drafts of prompts will be temporarily stored in the user's browser `localStorage`.
- **Caching:** Next.js's server-side data cache will be used for read operations. Server Actions will use `revalidateTag` and `revalidatePath` to invalidate caches after mutations, ensuring UI consistency.
- **Backup and Recovery:** Handled automatically by the Supabase platform.

## 5. API Specifications

### 5.1 Internal APIs
The internal API is composed of Next.js Server Actions. All actions must perform user session validation.

- **`features/auth/actions.ts`**
    - `signUp(data)`: Creates a new user in Supabase Auth.
    - `signIn(data)`: Signs in an existing user.
    - `signOut()`: Signs out the current user.
- **`features/folders/actions.ts`**
    - `getRootFolders(): Promise<Folder[]>`: Fetches folders where `parent_id` is null.
    - `getFolderChildren(parentId: string): Promise<Folder[]>`: Fetches child folders.
    - `createFolder(data: { name: string, parentId: string | null }): Promise<Folder>`: Creates a new folder.
    - `updateFolderName(folderId: string, newName: string): Promise<Folder>`: Renames a folder.
    - `deleteFolder(folderId: string): Promise<{ success: boolean }>`: Deletes a folder (and its contents via cascade).
- **`features/prompts/actions.ts`**
    - `getPromptsByFolder(folderId: string): Promise<Prompt[]>`: Fetches all prompts within a folder.
    - `createPrompt(data: { title: string, folderId: string | null }): Promise<Prompt>`: Creates a new, empty prompt.
    - `updatePrompt(promptId: string, data: { title?: string, content?: string }): Promise<Prompt>`: Updates prompt details.
    - `deletePrompt(promptId: string): Promise<{ success: boolean }>`: Deletes a prompt.
- **`features/editor/actions.ts`**
    - `saveNewVersion(promptId: string, newContent: string): Promise<PromptVersion>`: Creates a new prompt version.
    - `getPromptVersions(promptId: string): Promise<PromptVersion[]>`: Fetches the version history for a prompt.

### 5.2 External Integrations
- **Supabase:**
    - **Auth:** Integration via `@supabase/ssr` library for session management and auth operations.
    - **Database:** Integration via the Prisma client, configured with the Supabase connection string.

## 6. Security and Privacy

### 6.1 Authentication and Authorization
- **Authentication:** Managed by Supabase Auth using secure cookies. The `middleware.ts` file will handle session validation for all protected routes.
- **Authorization:** Implemented via **Row Level Security (RLS)** in Supabase. RLS policies will be enabled on all tables containing user data.
- **Example RLS Policy for `Prompts` table:**
    ```sql
    -- Enable RLS on the table
    ALTER TABLE "Prompts" ENABLE ROW LEVEL SECURITY;

    -- Policy: Users can SELECT their own prompts
    CREATE POLICY "Allow individual read access"
    ON "Prompts" FOR SELECT
    USING (auth.uid() = user_id);

    -- Policy: Users can INSERT prompts for themselves
    CREATE POLICY "Allow individual insert access"
    ON "Prompts" FOR INSERT
    WITH CHECK (auth.uid() = user_id);

    -- Policy: Users can UPDATE their own prompts
    CREATE POLICY "Allow individual update access"
    ON "Prompts" FOR UPDATE
    USING (auth.uid() = user_id);

    -- Policy: Users can DELETE their own prompts
    CREATE POLICY "Allow individual delete access"
    ON "Prompts" FOR DELETE
    USING (auth.uid() = user_id);
    ```
    *Similar policies will be applied to `Folders`, `Tags`, and `Profiles`.*

### 6.2 Data Security
- **Encryption:** Data in transit is encrypted via HTTPS. Data at rest is encrypted by Supabase's underlying cloud provider.
- **PII Handling:** The only PII stored is the user's email address, which is managed securely within the `auth.users` table by Supabase.
- **Compliance:** The application will be designed to be GDPR compliant by ensuring users can manage and delete their own data.

### 6.3 Application Security
- **Input Validation:** All data submitted to Server Actions from the client **must** be validated using Zod schemas to prevent malformed data and potential injection attacks.
- **Secrets Management:** All sensitive keys (database URL, Supabase keys) will be stored as environment variables on Vercel and will not be exposed to the client.

## 7. User Interface Specifications

### 7.1 Design System
- **Visual Principles:** "Bold Simplicity" - a clean, uncluttered, professional UI that prioritizes content and efficiency.
- **Component Library:** Built by composing `shadcn/ui` primitives. All components will be styled with Tailwind CSS utility classes that reference the CSS variables defined in the color system.
- **Responsive Design:** The application will be fully responsive, with the three-pane layout adapting for smaller screens (e.g., collapsing the sidebar into a menu).
- **Accessibility:** Adherence to WCAG 2.1 AA standards. This includes semantic HTML, keyboard navigability, and sufficient color contrast.

### 7.2 Design Foundations
These will be defined as CSS variables in `src/styles/globals.css` to enable theming.

#### 7.2.1 Color System
```css
/* In globals.css */
:root {
  --background: 222.2 84% 4.9%; /* Gray 900 */
  --foreground: 210 40% 98%; /* Off-White */

  --primary: 243.8 89.9% 62.2%; /* #4F46E5 */
  --primary-foreground: 210 40% 98%; /* Off-White */

  --secondary: 217.2 32.6% 17.5%; /* Gray 800 */
  --secondary-foreground: 210 40% 98%; /* Off-White */

  --accent: 333.6 79.1% 61.2%; /* #EC4899 */
  --accent-foreground: 210 40% 98%;

  --destructive: 0 84.2% 60.2%; /* #EF4444 */
  --destructive-foreground: 210 40% 98%;

  --border: 217.2 32.6% 17.5%; /* Gray 800 */
  --input: 217.2 32.6% 17.5%; /* Gray 800 */
  --ring: 243.8 89.9% 62.2%; /* Primary Indigo */

  --radius: 0.5rem; /* 8px */
}
/* Light mode variables would also be defined here */
```

#### 7.2.2 Typography
- **Font Families:**
    - **Primary:** `Inter` (sans-serif)
    - **Monospace:** `Fira Code`
- **Type Scale:**
    - **H1:** 24px/32px, Semibold (600)
    - **H2:** 20px/28px, Semibold (600)
    - **H3:** 16px/24px, Semibold (600)
    - **Body:** 14px/20px, Regular (400)
    - **Body Small:** 12px/16px, Regular (400)
    - **Label:** 12px/16px, Medium (500), All Caps
    - **Button:** 14px/20px, Medium (500)

#### 7.2.3 Spacing and Layout
- **Base Unit:** 4px grid system.
- **Spacing Scale:**
    - `4px`: Micro
    - `8px`: Small
    - `12px`: Compact
    - `16px`: Default
    - `24px`: Medium
    - `32px`: Large
    - `48px`: Extra-large
- **Layout:** Three-pane layout with fixed left sidebar (~240px) and two flexible, resizable panes for the prompt list and editor.

#### 7.2.4 Interactive Elements
- **Button States (Primary):**
    - **Default:** `bg-primary`, `text-primary-foreground`
    - **Hover:** `bg-primary/90` (e.g., Indigo Light `#6366F1`)
    - **Focus:** `ring-2 ring-ring ring-offset-2`
- **Input States:**
    - **Default:** `border-input`, `bg-background`
    - **Focus:** `border-primary`, `box-shadow: 0 0 0 2px #4F46E520`
- **Animation:**
    - **Standard Transition:** 200ms, `cubic-bezier(0.4, 0, 0.2, 1)`
    - **Layout Transition:** 300ms, `cubic-bezier(0.4, 0, 0.2, 1)`

### 7.3 User Experience Flows
- **Folder Expansion:** On click, a disclosure triangle rotates 90 degrees over 150ms. If subfolders are not loaded, a spinner appears. Once loaded, the sub-list animates in using `Framer Motion`'s `AnimatePresence`, expanding its height over 300ms.
- **Authentication Error:** On submission with invalid credentials, the primary button reverts from its loading state, and an error message with `text-destructive` color appears below the button with a subtle "shake" animation from Framer Motion.
- **Empty States:** Empty folders or search results with no matches will display a centered message with a decorative Lucide icon and helpful text, as specified in the UI/UX guide.

## 8. Infrastructure and Deployment

### 8.1 Infrastructure Requirements
- **Hosting:** Vercel platform.
- **Database:** Supabase managed Postgres instance.
- **Environment Variables:**
    - `DATABASE_URL`: Prisma connection string for migrations.
    - `DIRECT_URL`: Prisma direct connection string for the query engine.
    - `NEXT_PUBLIC_SUPABASE_URL`: Public Supabase project URL.
    - `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Public Supabase anonymous key.
    - `SUPABASE_SERVICE_ROLE_KEY`: Secret key for admin tasks (used sparingly, e.g., in seeding scripts).

### 8.2 Deployment Strategy
- **CI/CD:** Managed by Vercel.
    - Pushing to the `main` branch triggers a production deployment.
    - Creating a Pull Request automatically generates a unique preview deployment URL for testing and review.
- **Deployment Procedures:**
    1.  Developer pushes feature branch and opens a PR.
    2.  Vercel builds a preview deployment. E2E tests (Playwright) run against this preview environment.
    3.  After PR approval and merge to `main`, Vercel builds and deploys to production.
    4.  Database migrations (Prisma Migrate) must be run manually against the production database via the Supabase dashboard or a secure CLI environment before merging code that depends on schema changes.
- **Rollback Strategy:** Vercel's immutable deployments allow for instant rollbacks to a previous successful deployment via the Vercel dashboard.