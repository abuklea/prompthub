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

### 6. Apply Supabase SQL Scripts

To ensure the application functions correctly, you need to run two SQL scripts on your Supabase database. These scripts set up the user profile trigger and the security policies.

Navigate to the **SQL Editor** in your Supabase dashboard and run the contents of the following files one by one:

1.  **User Profile Trigger:** This script creates a trigger to automatically add a new user to the `Profile` table upon sign-up.
    -   Open and run the SQL from: `wip/T2.1-supabase-profile-trigger.sql`

2.  **Row Level Security (RLS) Policies:** These policies ensure that users can only access their own data.
    -   Open and run the SQL from: `wip/T3.1-rls-policies.sql`

### 7. Run the Development Server

You are now ready to start the application:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result. You should be able to sign up, log in, and access the main application.
