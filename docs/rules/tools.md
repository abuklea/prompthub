# MCP TOOL USAGE

MCP servers are configured per developer: the repository has no `.mcp.json`. The servers this project uses are
`serena` and `chrome-devtools`. When one is unavailable, say so and continue with built-in tools.

1. ALWAYS track work in GitHub Issues per `github-issues.md`. `archon` is legacy and read-only: use it only to export
   tasks and records for the Archon import (#29).
2. ALWAYS use `serena` for code structure, cross-references and symbol-level edits (language-server based). Use it to
   map the architecture, track calls and imports, and make precise edits.
3. Use `chrome-devtools` to check UI changes in the running app (dev server on port 3010): snapshots, console and
   network inspection, scripted clicks and form fills. No e2e runner exists (`{{E2E_CMD}}` is `none`), so this is the
   browser check.
4. No `time`, `mermaid`, `brave` or `seqthk` server: timestamps and diagrams follow `project.md`.
