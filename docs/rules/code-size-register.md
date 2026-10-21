# Code Size Register

| `Title` | `Created` | `Last modified` |
|---------|-----------|-----------------|
| Code Size Register | 19/10/2026 18:13 GMT+10 | 22/10/2026 08:59 GMT+10 |

## Table of Contents
- [Purpose](#purpose)
- [Source Files](#source-files)
- [Test Files](#test-files)

## Purpose

One row per RED file (past 600 lines or 8,000 estimated tokens, or judged RED in review) with its decision; the
rules are in `code-size.md`. `scripts/audit-code-size.sh` parses these tables: the first cell is the current line
count and the second the path in backticks, so keep that shape. A `split` row names its issue; an `accept` row gives
its reason.

## Source Files

| Lines | File | Area | Decision | Notes |
|-------|------|------|----------|-------|
| 674 | `src/features/prompts/actions.ts` | backend | split | Default from the code-size migration (source file: `split`). Tracked in #51: split at the prompt CRUD, search, tags and version-history seams. ESLint `max-lines` is disabled in the file until the split. |

## Test Files

| Lines | File | Area | Decision | Notes |
|-------|------|------|----------|-------|
