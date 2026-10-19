# Tools and MCP Servers

| `Title` | `Created` | `Last modified` |
|---------|-----------|-----------------|
| Tools and MCP Servers | 07/11/2025 12:46 GMT+10 | 19/10/2026 23:07 GMT+10 |

## Table of Contents
- [MCP Servers](#mcp-servers)
- [Cloud Sessions](#cloud-sessions)

## MCP Servers

MCP servers are configured per developer: the repository has no `.mcp.json`. The developer's machine runs `serena`,
`chrome-devtools`, `seqthk` and `time`. When one is unavailable, say so and continue with built-in tools.

1. ALWAYS track work in GitHub Issues per `github-issues.md`. `archon` is legacy and read-only: use it only to export
   tasks and records for the Archon import (#29).
2. ALWAYS use `serena` for code structure, cross-references and symbol-level edits (language-server based). Use it to
   map the architecture, track calls and imports, and make precise edits.
3. Use `chrome-devtools` to check UI changes in the running app (dev server on port 3010): snapshots, console and
   network inspection, scripted clicks and form fills. No e2e runner exists (`{{E2E_CMD}}` is `none`), so this is the
   browser check.
4. Use `seqthk` for complex tasks that need research or planning first.
5. Use `time` for the current date and time and timezone conversion; document timestamps use `{{TIMEZONE}}`.
6. No `brave` server; diagrams follow `project.md`.

## Cloud Sessions

- Cloud sessions (claude.ai/code) start none of the four servers; they can carry claude.ai connectors such as GitHub
  and Supabase.
- GitHub: the MCP tools or `gh api` REST calls (`docs/rules/github-issues.md#sync-and-commands`).
- Supabase connector: read only (tables, advisors, logs). NEVER apply a migration or run writing SQL through it; the
  database rules in `docs/rules/project.md#database-auth-and-tenancy` apply.
- Timestamps without `time`: `TZ=Australia/Brisbane date '+%d/%m/%Y %H:%M'`.
