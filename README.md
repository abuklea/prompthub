# PromptHub

PromptHub is a powerful, open-source application designed to be a centralized repository for developers, researchers, and content creators to efficiently store, organize, and manage their AI prompts. It features a modern, themeable, and responsive interface with a robust backend, providing a "GitHub for prompts" experience.

## Core Features

-   **Nested Folder Organization:** Structure your prompts in a hierarchical folder system for easy navigation.
-   **Full-Text Search:** Quickly find any prompt using a powerful, indexed search.
-   **Rich Prompt Editor:** Create and edit prompts in a VS Code-like environment powered by the Monaco Editor.
-   **Git-Style Version Control:** Track every change to your prompts with a diff-based versioning system.
-   **Tagging System:** Organize and filter prompts using descriptive tags.
-   **Secure and Private:** User data is secured with Supabase Authentication and isolated with Row Level Security.

## Technology Stack

PromptHub is built with a modern, type-safe, and scalable technology stack:

-   **Framework:** [Next.js](https://nextjs.org/) (App Router)
-   **Backend Logic:** [Next.js Server Actions](https://nextjs.org/docs/app/building-your-application/data-fetching/server-actions-and-mutations)
-   **Database & Auth:** [Supabase](https://supabase.com/) (Postgres + Authentication)
-   **ORM:** [Prisma](https://www.prisma.io/)
-   **UI Components:** [shadcn/ui](https://ui.shadcn.com/)
-   **Styling:** [Tailwind CSS](https://tailwindcss.com/)
-   **Client State:** [Zustand](https://github.com/pmndrs/zustand)
-   **Validation:** [Zod](https://zod.dev/)
-   **Animation:** [Framer Motion](https://www.framer.com/motion/)
-   **Editor:** [Monaco Editor](https://microsoft.github.io/monaco-editor/)

## Getting Started

Follow these instructions to set up and run the project locally.

### 1. Clone the Repository

```bash
git clone https://github.com/your-username/prompthub.git
cd prompthub
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Set Up Environment Variables

Create a `.env` file in the root of the project by copying the example file:

```bash
cp .env.example .env
```

Next, create a new project on [Supabase](https://supabase.com/). In your Supabase project dashboard, navigate to **Project Settings > API** to find your project URL and `anon` key. Add these to your `.env` file:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL="YOUR_SUPABASE_URL"
NEXT_PUBLIC_SUPABASE_ANON_KEY="YOUR_SUPABASE_ANON_KEY"
```

### 4. Set Up the Database

Navigate to **Project Settings > Database** in your Supabase dashboard to find your database connection string. You will need the URI string, which includes the password you set when creating the project. Add this to your `.env` file for both `DATABASE_URL` and `DIRECT_URL`:

```env
# Prisma
DATABASE_URL="YOUR_DATABASE_CONNECTION_STRING"
DIRECT_URL="YOUR_DATABASE_CONNECTION_STRING"
```

### 5. Run Database Migrations with Prisma

With your database connection string in place, run the Prisma migration to set up your database schema:

```bash
npx prisma migrate dev
```

This command will sync your Supabase database with the schema defined in `prisma/schema.prisma`.

### 6. (Optional) Apply Row Level Security Policies

Tenant isolation is enforced in application code: every server action authenticates the
user and scopes every Prisma query by `user_id`. You do **not** need any database trigger
for the app to work — new `Profile` rows are created in application code via
`ensureProfileExists()`, and Supabase Cloud does not permit triggers on `auth.users`.

If you additionally want Postgres Row Level Security as defence-in-depth (it constrains
connections that carry the end-user JWT, i.e. the Supabase client), open the **SQL Editor**
in your Supabase dashboard and run the contents of:

-   `wip/P3S1-rls-policies.sql`

Note: RLS does not constrain Prisma, which connects with a database role, so this is a
secondary layer and not required for the application to enforce isolation.

### 7. Run the Development Server

You are now ready to start the application:

```bash
npm run dev
```

Open [http://localhost:3010](http://localhost:3010) with your browser to see the result. You should be able to sign up, log in, and access the main application.
