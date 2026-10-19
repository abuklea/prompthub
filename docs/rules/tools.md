# MCP TOOL USAGE

MCP servers are configured per developer: the repository has no `.mcp.json`. When a server named below is not
available, say so and continue with built-in tools.

1. ALWAYS track work in GitHub Issues per `github-issues.md`. `archon` is legacy and read-only: use it only to export
   tasks and records for the Archon import (#29).
2. ALWAYS use `serena` for code structure, cross-references and symbol-level edits (language-server based). Use it to
   map the architecture, track calls and imports, and make precise edits.
3. Use these when the task calls for them:

| Server | Use |
|---|---|
| `brave` | Debugging, online research, library documentation, code examples |
| `seqthk` | Complex tasks that need research or planning first |
| `time` | Current date and time, timezone conversion (`{{TIMEZONE}}` for document timestamps) |
| `mermaid` | Render `mermaid` markdown to images (below) |

## Mermaid

- Call `mermaid` for every diagram written into a document, once per format: `png` and `svg`, both with a
  transparent background (two files per diagram).
- Parameters: `code` (the mermaid text), `backgroundColor: 'transparent'`, `outputFormat: 'png' | 'svg'`,
  `name: '<filename>-<diagram_id>'` (no duplicate extension), `folder: '{{WORKSPACE_FOLDER}}/mermaid'` (absolute).
