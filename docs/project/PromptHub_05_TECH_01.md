# PromptHub - Technical Specifications

## 1. Executive Summary
- **Project Overview and Objectives:** PromptHub is a centralized web application designed for AI developers, researchers, and content creators to efficiently store, organize, version, and manage their AI prompts. The primary objective is to provide a secure, high-performance, and intuitive "GitHub for prompts," featuring a nested folder structure, robust search, a rich text editor with version control, and a comprehensive tagging system.
- **Key Technical Decisions and Rationale:**
    - **Framework:** Next.js with the App Router is chosen for its performance, hybrid rendering capabilities (Server and Client Components), and integrated backend logic via Server Actions.
    - **Backend Logic:** Next.js Server Actions will be the exclusive method for all backend logic, co-locating mutations and queries with the components that use them, simplifying the architecture and eliminating the need for a separate API layer.
    - **Database & Auth:** Supabase is selected for its integrated solution, providing a managed Postgres database and a robust authentication system. Prisma connects with a database role, which Row Level Security (RLS) does not constrain, so data isolation is enforced in application code: every Server Action authenticates the user and scopes every query by `user_id`. RLS is optional defence-in-depth (section 6.1).
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
            F[Postgres Database]
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
    - **Next.js Backend (Server Actions):** A serverless backend co-located within the Next.js application. Each Server Action authenticates the caller with `supabase.auth.getUser()` and handles the business logic, data validation (Zod), and database communication (Prisma).
    - **Supabase:** A managed cloud service providing the core data persistence layer (Postgres) and user authentication. Authorization is the `user_id` scope of the application's queries; RLS is optional defence-in-depth.
- **Data Flow Diagrams:**
    - **Read Operation (e.g., Fetching Prompts):**
        1.  User clicks a folder in the React client.
        2.  The client component invokes a Server Action, e.g., `getPromptsByFolder({ folderId })`.
        3.  The Server Action validates the user's session.
        4.  Prisma client queries the Supabase DB for prompts where `folder_id` matches and `user_id` matches the authenticated user's ID (enforced by the query's `user_id` filter).
        5.  Data is returned to the client component and rendered.
    - **Write Operation (e.g., Creating a Folder):**
        1.  User submits a "New Folder" form.
        2.  A Server Action, e.g., `createFolder(data)`, is invoked.
        3.  Zod validates the input `data` schema.
        4.  Prisma client executes an `INSERT` command into the `Folders` table.
        5.  The Server Action calls `revalidatePath("/")` to invalidate the client-side cache.
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
    │   │   ├── actions.ts    # signIn, signUp, signOut server actions
    │   │   └── handlers.ts   # signIn, signUp bodies: (deps, data)
    │   ├── folders/
    │   │   ├── components/   # FolderTree.tsx, FolderItem.tsx
    │   │   ├── actions.ts    # createFolder, renameFolder, deleteFolder... server actions (wrappers)
    │   │   └── handlers.ts   # their bodies on runAction: (deps, data)
    │   └── editor/
    │       ├── components/   # EditorPane.tsx, VersionHistory.tsx
    │       ├── actions.ts    # saveNewVersion, autoSavePrompt server actions (wrappers)
    │       ├── handlers.ts   # their bodies on runAction
    │       ├── service.ts    # save and restore logic taking (db, userId, input)
    │       └── ...
    ├── components/           # Shared, primitive UI components (from shadcn/ui)
    │   └── ui/               # Button.tsx, Card.tsx, etc.
    ├── lib/                  # Shared libraries and utilities
    │   ├── db.ts             # Prisma client instance
    │   ├── action-runner.ts  # runAction: parse, authenticate, rate-limit, ensure profile, run
    │   ├── supabase/         # Supabase browser and server clients
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
    - Protect the `(app)` routes in their layout (`src/app/(app)/layout.tsx` redirects to the login page without a user); `src/middleware.ts` only redirects a signed-in user away from `/login`.
    - Create the `Profiles` entry in application code (`ensureProfileExists`), not in a trigger: Supabase Cloud does not permit triggers on `auth.users`.
    - The UI must handle default, loading, and error states as defined in the UI/UX guide.
- **Implementation Approach:**
    1.  **Sign-Up/Login UI:** Create a client component `AuthForm.tsx` that toggles between Sign In and Sign Up views.
    2.  **Server Actions:**
        -   `signUp(values)`: Calls Supabase's `signUp` method.
        -   `signIn(values)`: Calls Supabase's `signInWithPassword` method.
        -   `signOut()`: Calls Supabase's `signOut` method, after the Header has purged the client state.
    3.  **Route protection:** the `(app)` layout looks up the user on the server and redirects to the login page without one. `src/middleware.ts` matches `/login` only and redirects a user who carries a Supabase auth cookie to `/dashboard`; it does not refresh sessions.
    4.  **Profile Management:** The profile page calls the Server Action `updateDisplayName`, which uses Prisma to update the `display_name` in the `Profile` table. A password-reset action is not implemented.
- **API (Server Actions):**
    - `signUp(values: z.input<typeof SignUpSchema>): Promise<ActionResult<{ redirectTo: string }>>`
    - `signIn(values: z.input<typeof SignInSchema>): Promise<ActionResult<{ redirectTo: string }>>`
    - `signOut(): Promise<void>`: redirects to the login page.
    - `getProfileDetails(): Promise<ActionResult<ProfileDetails>>`
    - `updateDisplayName(data: { displayName }): Promise<ActionResult<{ displayName: string }>>`
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
    1.  **Folder Tree:** The `FolderTree.tsx` component will fetch initial root folders (`parentId` is `NULL`). Each `FolderItem.tsx` with children will have a disclosure triangle. Clicking it will invoke a Server Action `getFolderChildren({ parentId })` and render the children.
    2.  **State Management:** A Zustand store will manage the expanded/collapsed state of folders in the tree.
    3.  **Drag and Drop:** A library like `dnd-kit` will be used. On drop, a Server Action `moveItem(itemId, targetFolderId)` is called. The client UI will show a loading state on the dragged item until the action completes.
    4.  **Full-Text Search:** An input field will call the Server Action `getPromptsByFolder({ folderId, query })` on change (with debouncing). With a non-blank `query` the handler (`search-handlers.ts`, not an action of its own) uses Prisma's raw query capabilities to search against the `content_tsv` column.
- **API (Server Actions):**
    - `getRootFolders(): Promise<ActionResult<Folder[]>>`, `getFolderChildren({ parentId }): Promise<ActionResult<Folder[]>>`
    - `createFolder({ name, parentId }): Promise<ActionResult<Folder>>`
    - `moveItem(itemId: string, itemType: 'prompt' | 'folder', targetFolderId: string | null): Promise<{ success: boolean }>`: planned with drag and drop; not implemented
    - `getPromptsByFolder({ folderId, query?, tagIds? }): Promise<ActionResult<PromptListItem[]>>`: lists the folder, or searches it when `query` is non-blank
- **Data Models Involved:** `Folders`, `Prompts`.
- **Error Handling:** Network errors during lazy-loading or search will display a toast notification. Failed drag-and-drop operations will revert the item to its original position and show an error toast.

### 3.3 Prompt Editor & Version Control
- **User Stories:**
    - I want a powerful editor with syntax highlighting.
    - I want my work auto-saved so I don't lose it.
    - I want to view a history of all saved changes.
    - I want a side-by-side "diff" view to compare two versions.
- **Technical Requirements:**
    - Integrate the Monaco Editor for the editing experience.
    - Keep unsaved content in the browser per document as a draft, and autosave the current title and content to the server without creating a version. The draft is a v1 JSON envelope `{"v":1,"base":"<hash of the server content it began from>","content":"..."}` under the key `prompt-v1-<promptId>` and covers the content only, not the title. It exists only while the working content differs from what the server holds and is removed once a save catches up. A draft whose base no longer matches the server content is not applied: its text is stashed under `prompt-v1-<promptId>:conflict` and offered once by a toast with the action "Restore my text".
    - When a user manually saves, the prompt is written and the saved title and content are recorded as a new version, unless the newest version already holds exactly that state.
    - The diff view must be implemented using Monaco Editor's built-in diffing capabilities.
- **Implementation Approach:**
    1.  **Editor Component:** Create an `Editor.tsx` component that dynamically imports `@monaco-editor/react` to avoid SSR issues.
    2.  **Auto-Saving:** The editor keeps the browser draft described above, and a debounced call to the `autoSavePrompt` Server Action writes the current title and content to the `Prompts` table. Autosave records no `PromptVersions` entry.
    3.  **Manual Save:** The "Save" button calls the Server Action `saveNewVersion({ promptId, newTitle, newContent })`.
        -   It writes the title, content and `updated_at` of the `Prompts` row, scoped to the signed-in user, in one transaction with the version.
        -   It records the saved title and content as a new `PromptVersions` entry (`title_snapshot`, `content_snapshot`), unless the newest version already holds exactly that state. In that case it adds nothing and returns that version's id.
    4.  **Version History:** A "History" button opens a panel that lists the 50 newest `PromptVersions` for the current prompt, newest first, from the `getPromptVersionHistory` Server Action.
    5.  **Restore:** The panel's "Restore this version" button asks "Restore this version?" and only then calls `restorePromptVersion({ promptId, versionId })`. Holding the prompt row lock, it records the current unsaved row as a version when the newest version differs from it, writes the restored title and content to the prompt, records the restored state as a version unless the newest version already holds it, and returns the restored `{ title, content }`, which the editor then shows.
    6.  **Diff View:** Selecting two versions from the history panel will switch the Monaco editor into its diff mode, feeding it the `content_snapshot` of the two versions.
- **API (Server Actions):**
    - `getPromptDetails({ promptId }): ActionResult<PromptDetails>` (in `features/prompts/actions.ts`; the prompt with its folder, without versions)
    - `saveNewVersion({ promptId, newTitle, newContent }): ActionResult<{ versionId: number }>`
    - `autoSavePrompt({ promptId, title, content }): ActionResult<void>`
    - `getPromptVersionHistory({ promptId }): ActionResult<PromptVersionHistoryItem[]>` (in `features/prompts/history-actions.ts`)
    - `restorePromptVersion({ promptId, versionId }): ActionResult<{ title: string | null, content: string }>` (in `features/prompts/history-actions.ts`)
- **Server logic:** `features/editor/service.ts` holds `saveVersion`, `autoSaveDocument`, `restoreVersion` and `listVersions`, each taking `(db, userId, input)`. The handlers validate, authenticate and rate-limit (saves and restores 30 a minute in their own bucket, autosaves 240 a minute, history reads not limited), then call them.
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
  id               Int       @id @default(autoincrement())
  title_snapshot   String?   // The prompt title in this version
  content_snapshot String    @default("") // The prompt content in this version
  diff             String    @default("") // Legacy column, no longer computed
  created_at       DateTime  @default(now())

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
- **Data Persistence:** All application data will be persisted in the Postgres database via Prisma. The editor's unsaved content is kept as a per-document draft in the user's browser `localStorage` (section 3.3) until a save catches up.
- **Caching:** Next.js's server-side data cache will be used for read operations. Server Actions use `revalidatePath` to invalidate caches after mutations, ensuring UI consistency.
- **Backup and Recovery:** Handled automatically by the Supabase platform.

## 5. API Specifications

### 5.1 Internal APIs
The internal API is composed of Next.js Server Actions. All actions perform user session validation. Every action but `signOut` is a wrapper over a handler `(deps, data: unknown)` built on `runAction`, which parses the input with Zod, authenticates, rate-limits mutations, runs and catches, and returns an `ActionResult` (`{ success: true, data } | { success: false, error }`) with a fixed message on failure. The input is one object argument.

- **`features/auth/actions.ts`**
    - `signUp(values)`: Creates a new user in Supabase Auth.
    - `signIn(values)`: Signs in an existing user.
    - `signOut()`: Signs out the current user and redirects to the login page.
- **`features/folders/actions.ts`**
    - `getRootFolders(): ActionResult<Folder[]>`: Fetches folders where `parent_id` is null.
    - `getFolderChildren({ parentId }): ActionResult<Folder[]>`: Fetches child folders.
    - `createFolder({ name, parentId }): ActionResult<Folder>`: Creates a new folder at the root or under one of the caller's folders.
    - `renameFolder({ folderId, name }): ActionResult<Folder>`: Renames a folder.
    - `deleteFolder({ folderId }): ActionResult<{ folderIds: string[], promptIds: string[] }>`: Deletes a folder, its descendants and their prompts (via cascade), and returns every deleted folder id and prompt id.
- **`features/prompts/actions.ts`**
    - `getPromptsByFolder({ folderId, query?, tagIds? }): ActionResult<PromptListItem[]>`: Fetches the prompts within a folder, or searches them.
    - `createPrompt({ folderId, title? }): ActionResult<PromptListItem>`: Creates a new, empty prompt in one of the caller's folders.
    - `getPromptDetails({ promptId }): ActionResult<PromptDetails>`: Fetches one prompt with its folder.
    - `renamePrompt({ promptId, newTitle }): ActionResult<void>`: Renames a prompt.
    - `deletePrompt({ promptId }): ActionResult<void>`: Deletes a prompt.
    - `validatePrompts({ promptIds }): ActionResult<{ validIds: string[] }>`: Reports which of up to 200 ids are the caller's prompts.
- **`features/editor/actions.ts`**
    - `saveNewVersion({ promptId, newTitle, newContent }): ActionResult<{ versionId: number }>`: Saves the prompt and records the saved state as a version, unless the newest version already holds it.
    - `autoSavePrompt({ promptId, title, content }): ActionResult<void>`: Saves the prompt without recording a version.
- **`features/prompts/tag-actions.ts`**
    - `getTags({ folderId? }): ActionResult<Tag[]>`, `createTag({ name }): ActionResult<{ id, name }>`, `assignTagsToPrompt({ promptId, tagIds }): ActionResult<void>`: tags are scoped by `user_id` in the queries; the database does not enforce tag ownership (#107).
- **`features/prompts/history-actions.ts`** (version history)
    - `getPromptVersionHistory({ promptId }): ActionResult<PromptVersionHistoryItem[]>`: Fetches the 50 newest versions of a prompt, newest first.
    - `restorePromptVersion({ promptId, versionId }): ActionResult<{ title: string | null, content: string }>`: Restores the prompt to a version and records the working copy and the restored state in the history.

### 5.2 External Integrations
- **Supabase:**
    - **Auth:** Integration via `@supabase/ssr` library for session management and auth operations.
    - **Database:** Integration via the Prisma client, configured with the Supabase connection string.

## 6. Security and Privacy

### 6.1 Authentication and Authorization
- **Authentication:** Managed by Supabase Auth using secure cookies. Every Server Action validates the session with `supabase.auth.getUser()`, and the `(app)` layout redirects a visitor without a user to the login page.
- **Authorization:** Implemented in application code. Every Server Action scopes every Prisma query by the authenticated user's `user_id`; the composite keys of migration `20261029114511_composite_tenant_keys` make the database refuse a folder under another user's folder and a prompt in another user's folder. Prisma connects with a database role, so **Row Level Security (RLS)** does not constrain it. RLS policies (`wip/P3S1-rls-policies.sql`) are optional defence-in-depth for connections that carry the end-user JWT.
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
    *Similar policies apply to `Folders`, `Tags`, and `Profiles` in the optional policy file.*

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