---
GUIDE USAGE: When writing SQL queries for, and managing PostgreSQL databases.
---

# @title PostgreSQL SQL Style Guide
# @description Comprehensive style guide for writing clean and maintainable PostgreSQL SQL
# @category guides
# @created 2025-06-20T17:52:33+10:00
# @last_modified 2025-06-20T17:52:33+10:00

## General Guidelines

### Code Formatting
- Use lowercase for SQL reserved words
- Use consistent, descriptive identifiers
- Apply proper indentation and whitespace
- Store dates in ISO 8601 format: `yyyy-mm-ddThh:mm:ss.sssss`
- Add comments for complex logic using:
  - `/* Block comments */` for multi-line
  - `-- Line comments` for single-line

## Naming Conventions

### General
- Avoid SQL reserved words
- Keep names under 63 characters
- Use snake_case for all identifiers
- Table names: plural (e.g., `users`, `order_items`)
- Column names: singular (e.g., `name`, `created_at`)

### Foreign Keys
- Reference foreign tables using: `singular_table_name_id`
- Example: `user_id` references `users(id)`

## Table Design

### Table Creation
- No prefix like `tbl_`
- Always include an auto-incrementing primary key:
  ```sql
  id bigint generated always as identity primary key
  ```
- Use `public` schema by default
- Always add table comments (max 1024 characters)

### Column Guidelines
- Use singular names
- Avoid generic names like `id` without context
- Use lowercase except for acronyms
- Add `not null` constraints where appropriate
- Set default values when applicable

## Query Formatting

### Basic Structure
```sql
select
  column1,
  column2
from
  table_name
where
  condition1
  and condition2
order by
  column1;
```

### Small Queries
```sql
select *
from employees
where end_date is null;

update employees
set end_date = '2023-12-31'
where employee_id = 1001;
```

### Large Queries
```sql
select
  first_name,
  last_name,
  department_name
from
  employees e
join
  departments d on e.department_id = d.department_id
where
  e.start_date between '2021-01-01' and '2021-12-31'
  and e.status = 'active'
order by
  last_name,
  first_name;
```

## Joins and Subqueries

### Explicit Joins
- Always use explicit `join` syntax
- Prefix column names with table aliases
- Alias tables meaningfully

```sql
select
  e.employee_name,
  d.department_name,
  l.location_name
from
  employees e
join
  departments d on e.department_id = d.department_id
left join
  locations l on d.location_id = l.location_id;
```

### Subqueries
- Use subqueries for simple filtering
- Format for readability

```sql
select
  employee_name,
  salary
from
  employees
where
  salary > (
    select avg(salary)
    from employees
  );
```

## Common Table Expressions (CTEs)

### Basic CTE
```sql
with active_employees as (
  select *
  from employees
  where end_date is null
)
select * from active_employees;
```

### Multiple CTEs
```sql
with
department_stats as (
  -- Calculate department statistics
  select
    department_id,
    count(*) as employee_count,
    avg(salary) as avg_salary
  from
    employees
  group by
    department_id
),
high_value_departments as (
  -- Identify high-value departments
  select
    department_id
  from
    department_stats
  where
    avg_salary > 100000
)
-- Main query
select
  d.department_name,
  ds.employee_count,
  ds.avg_salary
from
  departments d
join
  department_stats ds on d.department_id = ds.department_id
where
  d.department_id in (select department_id from high_value_departments);
```

## Best Practices

### Indexing
- Create indexes on frequently queried columns
- Consider composite indexes for common query patterns
- Use `explain analyze` to verify index usage

### Constraints
- Add appropriate constraints (primary key, foreign key, unique, check)
- Use `not null` for required fields
- Set default values when appropriate

### Performance
- Use `limit` with `order by` for pagination
- Avoid `select *` in production code
- Use `exists()` instead of `count(*) > 0` for existence checks
- Consider materialized views for complex, frequently accessed data

## Example Table Creation

```sql
create table books (
  id bigint generated always as identity primary key,
  title text not null,
  author_id bigint not null references authors (id),
  isbn varchar(13) unique,
  published_date date,
  page_count integer check (page_count > 0),
  created_at timestamp with time zone default current_timestamp,
  updated_at timestamp with time zone default current_timestamp
);

comment on table books is 'Stores information about books in the library';
comment on column books.isbn is 'International Standard Book Number (13 digits)';
comment on column books.page_count is 'Number of pages, must be positive';
```

## Resources
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [PostgreSQL Style Guide](https://www.sqlstyle.guide/)
- [Use The Index, Luke!](https://use-the-index-luke.com/)