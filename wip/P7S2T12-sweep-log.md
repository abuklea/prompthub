# PromptHub
## P7S2T12 Documentation Sweep Log

| `Title` | `Created` | `Last modified` |
|---------|-----------|-----------------|
| P7S2T12 Documentation Sweep Log | 29/10/2026 22:28 GMT+10 | 29/10/2026 22:28 GMT+10 |

## Table of Contents
- [Changed](#changed)
- [Left alone](#left-alone)

## Changed

| Document | What |
|---|---|
| `docs/rules/project.md` | Layout, code-type table, server-action and handler pattern, tenant isolation, composite keys, `ensureProfileExists(db, userId)`, rate limits, isolation snippet, Stack row (DR-1, DR-7, DR-25) |
| `README.md` | Core Features line, step 6, database-backed tests (DR-2, DR-3, DR-22) |
| `.claude/agents/senior-backend-engineer.md`, `.gemini/agents/senior-backend-engineer.md` | Handler pattern (DR-4, DR-5) |
| `.claude/agents/qa-test-automation-engineer.md`, `.gemini/agents/qa-test-automation-engineer.md` | Handler tests, `testDeps`, isolation test (DR-21) |
| `docs/project/PromptHub_05_TECH_01.md`, `docs/project/PromptHub_01_MVP_01.md` | DR-8 to DR-15 and the action list |
| `.serena/memories/codebase_structure.md`, `code_style_conventions.md`, `project_overview.md` | Action pattern, structure, RLS wording |
| `PRPs/docs/P7S1-task-context.md`, `P7S1-task-briefs-client.md`, `P7S1-editor-persistence-contracts.md` | Moved line numbers dropped (DR-24) |
| `wip/P7S2-research-drift.md` | Closing notes DR-1 to DR-26 |

## Left alone

Records (INITIAL, REPORT, `PRPs/complete/`, dated audits, P7S2 plan documents), `docs/rules/testing.md` (isolation rule
confirmed), `.github/workflows/ci.yml` (comment still true), `.gemini` contract files (DR-26), generic guides under
`docs/guides/`.
