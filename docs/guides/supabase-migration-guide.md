---
GUIDE USAGE: When migrating database versions.
---

# @title Supabase Database Migration Guide
# @description Best practices and guidelines for creating and managing Supabase database migrations
# @category guides
# @created 2025-06-20T18:08:33+10:00
# @last_modified 2025-06-20T18:08:33+10:00

## Migration File Naming

### Format
```
YYYYMMDDHHmmss_short_description.sql
```

### Components
- `YYYY` - Four-digit year (e.g., 2025)
- `MM` - Two-digit month (01-12)
- `DD` - Two-digit day (01-31)
- `HH` - Two-digit hour (00-23, UTC)
- `mm` - Two-digit minute (00-59)
- `ss` - Two-digit second (00-59)
- `short_description` - Brief, kebab-case description

### Examples
```
20240620084500_create_profiles_table.sql
20240620153000_add_email_to_users.sql
```

## File Structure

### Required Location
```
supabase/
└── migrations/
    ├── 20240601000000_initial_schema.sql
    └── 20240602000000_add_feature_flags.sql
```

## SQL Guidelines

### General Rules
- Use lowercase for all SQL keywords and identifiers
- Include comprehensive header comments
- Document all destructive operations
- One migration per logical change
- Include rollback steps in comments if complex

### Header Template
```sql
-- Migration: Short description
-- Created at: YYYY-MM-DD HH:MM:SS +0000 UTC
-- Description: Detailed explanation of the migration
-- Affected tables: table1, table2
-- Dependencies: Other migrations this depends on
```

## Schema Changes

### Creating Tables
```sql
-- Create new table with RLS enabled
create table public.profiles (
  id uuid references auth.users on delete cascade not null primary key,
  username text unique,
  full_name text,
  avatar_url text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.profiles enable row level security;

-- Create indexes for performance
create index idx_profiles_username on public.profiles(username);

-- Add comments for documentation
comment on table public.profiles is 'User profile information';
comment on column public.profiles.username is 'Unique username';
```

### Modifying Tables
```sql
-- Add new column with comment
alter table public.profiles 
  add column if not exists bio text 
  constraint bio_length check (char_length(bio) <= 500);

comment on column public.profiles.bio is 'User biography, max 500 characters';

-- Modify existing column
alter table public.profiles 
  alter column full_name set not null;
```

### Row Level Security (RLS)

#### Policy Structure
```sql
-- Select policy for public data
create policy "Public profiles are viewable by everyone"
on public.profiles
for select
to public
using ( true );

-- Insert policy for authenticated users
create policy "Users can insert their own profile"
on public.profiles
for insert
to authenticated
with check ( auth.uid() = id );

-- Update policy for profile owners
create policy "Users can update own profile"
on public.profiles
for update
to authenticated
using ( auth.uid() = id )
with check ( auth.uid() = id );
```

## Data Migrations

### Inserting Data
```sql
-- Insert default roles
insert into public.roles (name, description)
values 
  ('admin', 'Administrator with full access'),
  ('editor', 'Can edit content'),
  ('viewer', 'Can view content')
on conflict (name) do nothing;
```

### Updating Data
```sql
-- Backfill created_at for existing records
update public.profiles
set created_at = now() at time zone 'utc'
where created_at is null;
```

## Best Practices

### Atomic Migrations
- Each migration should be self-contained
- Include all necessary checks and validations
- Handle potential errors gracefully

### Idempotency
- Use `if not exists` for table/column creation
- Check for existing constraints/indexes before adding
- Make migrations rerunnable without errors

### Performance
- Add indexes for frequently queried columns
- Consider batch operations for large data changes
- Avoid long-running transactions

## Rollback Strategy

### Documenting Rollbacks
```sql
-- Rollback steps (if needed):
-- alter table public.profiles drop column if exists bio;
-- drop policy if exists "Users can update own profile" on public.profiles;
-- drop policy if exists "Users can insert their own profile" on public.profiles;
-- drop policy if exists "Public profiles are viewable by everyone" on public.profiles;
-- drop table if exists public.profiles;
```

## Common Patterns

### Timestamp Management
```sql
-- Function to update updated_at
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now() at time zone 'utc';
  return new;
end;
$$ language plpgsql security definer;

-- Trigger for automatic updated_at
create trigger handle_profiles_updated_at
before update on public.profiles
for each row
execute function public.handle_updated_at();
```

### Soft Deletes
```sql
alter table public.items
add column if not exists deleted_at timestamp with time zone;

-- Example policy for soft deletes
create policy "Users can view non-deleted items"
on public.items
for select
to authenticated
using (deleted_at is null);
```

## Testing Migrations

### Local Testing
```bash
# Reset local database and apply migrations
supabase db reset

# Create a new migration
supabase migration new migration_name

# Apply pending migrations
supabase db push
```

### Verifying Migrations
```sql
-- Check applied migrations
select * from supabase_migrations.schema_migrations;

-- Verify table structure
\d+ public.profiles

-- Check RLS policies
\dp public.profiles
```

## Resources
- [Supabase CLI Documentation](https://supabase.com/docs/guides/cli)
- [PostgreSQL ALTER TABLE](https://www.postgresql.org/docs/current/sql-altertable.html)
- [PostgreSQL RLS Documentation](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)