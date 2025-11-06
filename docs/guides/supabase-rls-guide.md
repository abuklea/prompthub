---
GUIDE USAGE: When implementing RLS features and functionality with Supabase
---

# @title Supabase Row Level Security (RLS) Guide
# @description Comprehensive guide for implementing Row Level Security in Supabase
# @category guides
# @created 2025-06-20T18:05:33+10:00
# @last_modified 2025-06-20T18:05:33+10:00

## Core Concepts

### Authentication Roles
- `anon`: Unauthenticated requests (not logged in)
- `authenticated`: Authenticated requests (logged in)

### Policy Structure
```sql
CREATE POLICY "policy_name"
ON table_name
FOR operation  -- SELECT, INSERT, UPDATE, DELETE
TO role        -- authenticated, anon, or specific role
USING (condition)  -- For SELECT, UPDATE, DELETE
WITH CHECK (condition);  -- For INSERT, UPDATE
```

## Policy Best Practices

### Operation-Specific Policies
Create separate policies for each operation:

```sql
-- SELECT policy
CREATE POLICY "Users can view their own profile"
ON profiles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- INSERT policy
CREATE POLICY "Users can create their own profile"
ON profiles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- UPDATE policy
CREATE POLICY "Users can update their own profile"
ON profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- DELETE policy
CREATE POLICY "Users can delete their own profile"
ON profiles
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);
```

## Helper Functions

### `auth.uid()`
Returns the ID of the authenticated user.

### `auth.jwt()`
Returns the JWT of the authenticated user with metadata:
- `app_metadata`: Read-only metadata (secure for authorisation)
- `user_metadata`: User-editable metadata

### Example: Team-Based Access
```sql
CREATE POLICY "Team members can access team data"
ON team_data
FOR SELECT
TO authenticated
USING (
  team_id IN (
    SELECT jsonb_array_elements_text(
      auth.jwt() -> 'app_metadata' -> 'teams'
    )::uuid
  )
);
```

## Performance Optimisation

### 1. Add Indexes
```sql
CREATE INDEX idx_profiles_user_id ON profiles(user_id);
```

### 2. Optimise Function Calls
Use subqueries to cache function results:
```sql
-- Instead of:
USING (auth.uid() = user_id);

-- Use:
USING ((SELECT auth.uid()) = user_id);
```

### 3. Avoid Joins in Policies
Prefer array operations over joins:
```sql
-- Instead of:
USING (EXISTS (
  SELECT 1 FROM team_members 
  WHERE team_members.team_id = teams.id 
  AND team_members.user_id = auth.uid()
));

-- Use:
USING (teams.id IN (
  SELECT team_id FROM team_members 
  WHERE user_id = (SELECT auth.uid())
));
```

## Common Patterns

### Public Read, Authenticated Write
```sql
-- Public read access
CREATE POLICY "Public profiles are viewable by everyone"
ON profiles
FOR SELECT
TO public
USING (is_public = true);

-- Authenticated users can create profiles
CREATE POLICY "Users can create their profile"
ON profiles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);
```

### Team-Based Ownership
```sql
CREATE POLICY "Team members can manage team data"
ON team_data
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM team_members
    WHERE team_members.team_id = team_data.team_id
    AND team_members.user_id = (SELECT auth.uid())
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM team_members
    WHERE team_members.team_id = team_data.team_id
    AND team_members.user_id = (SELECT auth.uid())
  )
);
```

### Time-Based Access
```sql
CREATE POLICY "Access during business hours"
ON sensitive_data
FOR SELECT
TO authenticated
USING (
  EXTRACT(HOUR FROM CURRENT_TIME) BETWEEN 9 AND 17
  AND EXTRACT(DOW FROM CURRENT_TIMESTAMP) BETWEEN 1 AND 5
);
```

## Security Considerations

### Restrictive vs. Permissive
- Use `PERMISSIVE` (default) for most cases
- Use `RESTRICTIVE` only when explicitly needed for complex security requirements

### Multi-Factor Authentication (MFA)
```sql
CREATE POLICY "Require MFA for sensitive operations"
ON sensitive_table
FOR ALL
TO authenticated
USING (
  (SELECT auth.jwt()->>'aal') = 'aal2'  -- Requires MFA
);
```

## Testing RLS Policies

### Enable RLS on Tables
```sql
ALTER TABLE your_table ENABLE ROW LEVEL SECURITY;
```

### Test with Different Roles
```sql
-- As admin
SET ROLE postgres;
SELECT * FROM your_table;

-- As authenticated user
SET ROLE authenticated;
SET request.jwt.claim.sub = 'user-uuid';
SELECT * FROM your_table;

-- As anonymous
SET ROLE anon;
SELECT * FROM your_table;
```

## Common Issues

### Policy Conflicts
- Multiple policies are combined with `OR`
- Use `RESTRICTIVE` to require all conditions

### Performance Bottlenecks
- Add indexes on filtered columns
- Avoid expensive operations in policies
- Use `EXPLAIN ANALYZE` to identify slow queries

## Resources
- [Supabase RLS Documentation](https://supabase.com/docs/guides/auth/row-level-security)
- [PostgreSQL RLS Documentation](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
- [RLS Best Practices](https://supabase.com/blog/2021/03/05/row-level-security-in-postgresql)
