# PromptHub - Project Brief
This document outlines the high-level technical architecture for the PromptHub application's Minimum Viable Product (MVP). The goal is to create a centralized repository where users can efficiently store, organize, and manage their AI prompts, built with a modern, themeable, and responsive frontend.

## High-Level Architecture

### Frontend Architecture
The frontend is designed for a responsive, interactive, and themeable user experience.
- **Component Library:** We will use **shadcn/ui**, which provides a set of beautifully designed, accessible, and unstyled components. This allows for deep customization.
- **Theming:** The application will follow shadcn/ui's recommended theming approach, leveraging CSS variables for all design tokens (colors, spacing, radii). This makes the application easily themeable via a simple CSS file, compatible with tools like the shadcn studio theme generator. Custom components will be built by composing shadcn primitives to ensure they inherit theme properties correctly.
- **State Management:** **Zustand** will be used for global client-side state management. It will manage state that is complex or shared across many components, such as the open/closed state of the folder tree, the currently selected prompt, and user settings, avoiding prop-drilling and simplifying state logic.
- **Animation:** **Framer Motion** will be used to add fluid animations to user interactions, enhancing the user experience for actions like opening folders, modals, and drag-and-drop operations.

### Backend & Data Architecture
The backend leverages a serverless approach using Next.js and Supabase for simplicity, scalability, and tight integration.
- **Logic Layer:** **Next.js Server Actions** will be the exclusive method for all backend logic, including data mutations and queries. This colocates backend logic with the frontend components that use it, simplifying the codebase.
- **Data Validation:** **Zod** will be used to define schemas and validate all incoming data within Server Actions, ensuring type safety and data integrity before it reaches the database.
- **Database:** A cloud-hosted **Supabase (Postgres)** instance will serve as the primary database.
- **ORM:** **Prisma** will be the interface for all database operations, providing a type-safe client to interact with the Postgres database from within Server Actions.
- **Data Caching:** To ensure the UI remains synchronized with the backend state, we will use Next.js's built-in caching utilities. After a successful mutation (e.g., creating a folder), Server Actions will call `revalidateTag` or `revalidatePath` to intelligently invalidate the relevant caches and trigger a re-fetch of data on the client.

### Testing Strategy (MVP)
The testing strategy for the MVP is lean and focused on ensuring the reliability of critical functionalities without bloating the timeline.
- **Unit/Integration Tests for Server Actions (High Priority):** We will use **Vitest** to write tests for critical Server Actions. This will cover the core business logic, data validation, and database interactions, ensuring the backend is robust and correct.
- **End-to-End (E2E) Tests for Critical User Flows (Medium Priority):** A small suite of E2E tests will be written using **Cypress** or **Playwright**. These will cover the most important user journey: user sign-up, creating a new folder, and successfully creating and saving a prompt within it. This validates that the entire system works together as expected from a user's perspective.

## Features (MVP)

### Authentication & User Management
This feature handles user sign-up, login, and profile management using Supabase's built-in authentication services. It ensures that all user data is securely associated with their account.

#### Technology
- **Supabase Auth:** Manages the entire authentication lifecycle.
- **Next.js Middleware:** Protects routes using `@supabase/auth-helpers-nextjs`.
- **Supabase (Postgres):** A `profiles` table, populated by a trigger, will store application-specific user data.
- **Prisma:** Used to query the `profiles` table.

#### Requirements
- A Postgres trigger must automatically create a new user profile upon sign-up.
- The system must differentiate between public and private routes.

### Prompt Organization & Retrieval
This feature allows users to create a nested folder structure, use tags, and perform full-text searches to find prompts quickly and efficiently.

#### Technology
- **Next.js (Server Actions):** Handles all logic for CRUD and search operations.
- **Prisma:** Manages all database interactions.
- **Supabase (Postgres):**
    - A `Folder` table with a `parentId` for the nested hierarchy.
    - A many-to-many relationship for `Prompts` and `Tags`.
    - A `tsvector` column with a GIN index for performant **Full-Text Search**.

#### Requirements
- The folder hierarchy will be **lazy-loaded** to ensure fast initial page loads.
- Drag-and-drop operations will use a **pessimistic UI update**; the UI will only reflect the change after receiving a successful confirmation from the server.
- The UI must provide clear loading indicators for lazy-loading folders and search actions.

### Prompt Creation, Viewing & Editing
This is the core feature, providing a rich interface for users to create, view, and edit prompts, complete with a git-style version control system to track changes.

#### Technology
- **Next.js (Server Actions):** Executes all CRUD operations for prompts and their versions.
- **Monaco Editor:** Provides a powerful, VS Code-like editing experience with syntax highlighting.
- **Prisma:** Manages all interactions with the `Prompt` and `PromptVersion` models.
- **diff-match-patch:** A library to compute and store text differences between versions, optimizing storage.

#### Requirements
- The version control system will store changes as diffs.
- The UI must include a **diff viewer**, using Monaco Editor's diffing capabilities, to provide a clear, side-by-side comparison between versions.
- The editor will feature auto-saving to local storage to prevent data loss.

## Detailed Database Schema
Below is the proposed schema for the core tables. Primary Keys, Foreign Keys, and important indexes are specified.

**`Profiles`**
| Column | Type | Constraints | Description |
| --- | --- | --- | --- |
| `id` | `UUID` | Primary Key, Foreign Key (`auth.users.id`) | References the user in Supabase Auth. |
| `display_name` | `TEXT` | `NULL` | The user's chosen display name. |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL`, `DEFAULT now()` | Timestamp of profile creation. |

**`Folders`**
| Column | Type | Constraints | Description |
| --- | --- | --- | --- |
| `id` | `UUID` | Primary Key, `DEFAULT gen_random_uuid()` | Unique identifier for the folder. |
| `name` | `TEXT` | `NOT NULL` | The name of the folder. |
| `user_id` | `UUID` | `NOT NULL`, Foreign Key (`Profiles.id`) | The owner of the folder. |
| `parent_id` | `UUID` | Foreign Key (`Folders.id`), `NULL` | The parent folder (for nesting). `NULL` for root folders. |
| `created_at` | `TIMESTAMPTZ`| `NOT NULL`, `DEFAULT now()` | Timestamp of folder creation. |
| *Index* | `(user_id, parent_id)` | | To quickly fetch folders for a user within a parent. |

**`Prompts`**
| Column | Type | Constraints | Description |
| --- | --- | --- | --- |
| `id` | `UUID` | Primary Key, `DEFAULT gen_random_uuid()` | Unique identifier for the prompt. |
| `title` | `TEXT` | `NOT NULL` | The title of the prompt. |
| `content` | `TEXT` | `NOT NULL` | The main body of the prompt. |
| `format` | `TEXT` | `NOT NULL`, `DEFAULT 'markdown'` | The format of the content (e.g., 'markdown', 'xml'). |
| `user_id` | `UUID` | `NOT NULL`, Foreign Key (`Profiles.id`) | The owner of the prompt. |
| `folder_id` | `UUID` | Foreign Key (`Folders.id`), `NULL` | The folder this prompt belongs to. |
| `content_tsv`| `TSVECTOR`| | Indexed vector for full-text search. |
| `created_at` | `TIMESTAMPTZ`| `NOT NULL`, `DEFAULT now()` | Timestamp of prompt creation. |
| `updated_at` | `TIMESTAMPTZ`| `NOT NULL`, `DEFAULT now()` | Timestamp of the last update. |
| *Index* | `(user_id, folder_id)` | | To quickly fetch prompts for a user within a folder. |
| *Index* | `GIN(content_tsv)` | | GIN index for performant full-text search. |

**`PromptVersions`**
| Column | Type | Constraints | Description |
| --- | --- | --- | --- |
| `id` | `BIGSERIAL` | Primary Key | Unique identifier for the version record. |
| `prompt_id` | `UUID` | `NOT NULL`, Foreign Key (`Prompts.id`) | The prompt this version belongs to. |
| `diff` | `TEXT` | `NOT NULL` | The patch generated by `diff-match-patch`. |
| `created_at` | `TIMESTAMPTZ`| `NOT NULL`, `DEFAULT now()` | Timestamp of when this version was saved. |
| *Index* | `(prompt_id)` | | To quickly retrieve the version history for a prompt. |

## System Diagram
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
        G[Users (auth.users)]
        H[Profiles]
        I[Folders]
        J[Prompts]
        K[Tags & _PromptToTag]
        L[PromptVersions]
        M[FTS Index (GIN)]
    end

    A -- "Uses" --> A1 & A2
    A -- "Manages State with" --> A3
    A -- "Invokes" --> C
    B -- "Serves Pages" --> A
    C -- "Uses Prisma Client" --> F
    A -- "Authenticates via" --> E
    C -- "Validates User Session" --> E

    F -- "Contains" --> G
    F -- "Contains" --> H
    F -- "Contains" --> I
    F -- "Contains" --> J
    F -- "Contains" --> K
    F -- "Contains" --> L
    F -- "Maintains" --> M

    G -- "1-to-1 (Trigger)" --> H
    H -- "1-to-many" --> J
    H -- "1-to-many" --> I
    I -- "Self-ref (1-to-many)" --> I
    I -- "1-to-many" --> J
    J -- "many-to-many" --> K
    J -- "1-to-many" --> L
    J -- "Updates" --> M

    classDef services fill:#D6EAF8,stroke:#333,stroke-width:2px;
    classDef db fill:#E8DAEF,stroke:#333,stroke-width:2px;
    classDef fe fill:#D5F5E3,stroke:#333,stroke-width:2px;

    class A,B,C,A1,A2,A3 fe
    class E,F services
    class G,H,I,J,K,L,M db
```

## Deployment & DevOps
- **Hosting:** The Next.js application will be deployed and hosted on **Vercel**. This provides a seamless CI/CD pipeline with first-class support for Next.js features like Server Actions and serverless functions.
- **Database:** The Postgres database will be managed through the **Supabase** cloud platform. Supabase handles database provisioning, backups, and scaling.
- **Environment Management:** Vercel's environment variable management will be used to store sensitive information like database connection strings (`DATABASE_URL`) and Supabase service keys. Separate environments for `Production`, `Preview`, and `Development` will be maintained.
- **CI/CD:** Pushing to the `main` branch will trigger an automatic deployment to production. Pull requests will automatically generate unique preview deployments, allowing for thorough review before merging.

## Security & Compliance
- **Authentication:** All user authentication and session management is handled by Supabase Auth, which provides a secure, battle-tested system.
- **Authorization (RLS):** **Row Level Security (RLS)** will be enabled on all tables in the Supabase database. Policies will be written to ensure that users can only access and modify their own data. For example, a policy on the `Prompts` table will ensure that `SELECT` or `UPDATE` queries are only allowed if the `user_id` column matches the ID of the currently authenticated user (`auth.uid()`).
- **Data Validation:** All input from the client will be rigorously validated within Server Actions using **Zod** schemas. This prevents malformed data from reaching the database and acts as a primary defense against injection-style attacks.
- **Environment Variables:** All secrets and credentials will be stored as environment variables and will never be exposed to the client-side bundle. Vercel and Supabase provide secure mechanisms for managing these variables.