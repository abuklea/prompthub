# PromptHub

PromptHub is a web application for storing, organizing and managing AI prompts, with nested folders, a Monaco editor, version history, tags and full-text search.

## Core Features

-   **Nested Folder Organization:** Structure your prompts in a hierarchical folder system for easy navigation.
-   **Full-Text Search:** Search prompt titles and content through a GIN-indexed Postgres `tsvector` column (English configuration).
-   **Rich Prompt Editor:** Create and edit prompts in a VS Code-like environment powered by the Monaco Editor.
-   **Version History:** A manual save records the saved title and content as a version, unless the newest version already holds that state; autosave records none. A restore keeps the unsaved text as a version when it differs from the newest one, writes the restored state, and records that state as a version unless the newest version already holds it.
-   **Tagging System:** Organize and filter prompts using descriptive tags.
-   **Authentication and Per-User Data:** Users sign in with Supabase Authentication, and server actions filter queries by the signed-in user. Row Level Security is optional defence-in-depth (step 6). Known gaps in input validation and ownership checks are tracked in [#41](https://github.com/abuklea/prompthub/issues/41).

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

### Run with Docker (no Supabase project needed)

`docker-compose.yml` runs Postgres 17, GoTrue (Supabase Auth), an nginx gateway and the production build of the app. It needs no `.env` file and no Supabase account.

```bash
docker compose up --build -d   # first run builds the app image; the app applies the Prisma migrations on start
docker compose ps              # wait until db, auth and app report (healthy)
```

Open [http://localhost:3010](http://localhost:3010) and sign up with any email and password (emails are auto-confirmed). Postgres is also published on host port 54322. `docker compose down` stops the stack and keeps the data in the `pgdata` volume; `docker compose down -v` deletes that data. The stack serves a production build, so rebuild after a code change with `docker compose up --build -d`.

### Run on the host against Supabase Cloud

Follow these instructions to set up and run the project with `npm run dev` against a Supabase project. Port 3010 is shared with the Docker gateway, so run only one of the two.

### 1. Clone the Repository

```bash
git clone https://github.com/abuklea/prompthub.git
cd prompthub
```

### 2. Install Dependencies

```bash
npm ci
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

## Testing

Tests run with [Vitest](https://vitest.dev/) and sit beside the module they test as `src/**/*.test.ts` or
`src/**/*.test.tsx`:

```bash
npm test                # one run of every suite
npm run test:watch      # watch mode
npm run test:coverage   # one run with coverage, for the files listed in vitest.config.ts
```

Tests run in the `node` environment. A test of a hook or a component opts in to a simulated DOM with
`// @vitest-environment jsdom` on the first line of the file. The shared test helpers and fakes (the database helper, the
editor test environment, the storage and draft fakes) live in `src/test/`.

### Database-backed tests

The suites for the editor's server logic (`src/features/editor/service.*.test.ts`) run against a real Postgres. They
need `TEST_DATABASE_URL`, a connection string for a disposable database; without it they are skipped and `npm test`
still passes. They create and delete rows, so `src/test/db.ts` refuses a URL unless all of these hold:

-   the host is `localhost`, `127.0.0.1` or `[::1]`;
-   the database name contains `test`;
-   the URL has no `host`, `hostaddr` or `port` query parameter.

When `GITHUB_ACTIONS` is `true` and `TEST_DATABASE_URL` is unset, the run throws instead of skipping; the CI workflow
supplies a `postgres:17-alpine` service for it.

To provision a local test database, start the `db` service of `docker-compose.yml` (it publishes port 54322), create an
empty database whose name contains `test`, and apply the migrations to it. Replace `<user>` and `<password>` with the
values the `db` service sets, and never commit them:

```bash
docker compose up -d --wait db
docker compose exec db createdb -U "<user>" prompthub_test
export TEST_DATABASE_URL="postgresql://<user>:<password>@localhost:54322/prompthub_test"
DATABASE_URL="$TEST_DATABASE_URL" DIRECT_URL="$TEST_DATABASE_URL" npx prisma migrate deploy
npm test
```

Any other Postgres works the same way: point `TEST_DATABASE_URL` at an empty local database named `…test…` and run
`npx prisma migrate deploy` against it. Never point it at the Supabase project or any shared database.
