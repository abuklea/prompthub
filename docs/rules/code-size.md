# PromptHub
## Code Size and Agentability

| `Title` | `Created` | `Last modified` |
|---------|-----------|-----------------|
| Code Size and Agentability | 19/10/2026 18:13 GMT+10 | 19/10/2026 18:43 GMT+10 |

## Table of Contents
- [Purpose](#purpose)
- [File Bands](#file-bands)
- [Line Length](#line-length)
- [Functions and Modules](#functions-and-modules)
- [Exemptions](#exemptions)
- [Register and Gate](#register-and-gate)
- [Splitting](#splitting)

## Purpose

Agents and people both change this code. Keep every module small and coherent enough that an agent can understand,
change, test and review it in a narrow context. The numbers are agentability heuristics, not aesthetic laws. Lines
are the engineering constraint; tokens are the AI-context constraint.

## File Bands

A file's band is the worse of its line band and its token band. Estimated tokens = bytes / 4 (for banding, never
for billing).

| Band | Lines | Est. tokens | Action |
|---|---|---|---|
| GREEN (preferred) | <= 300 | <= 4,000 | one clear responsibility |
| YELLOW (acceptable) | 301-600 | 4,001-8,000 | still coherent; plan a split past ~500 lines if it holds more than one responsibility |
| RED (investigate) | > 600 | > 8,000 | record a decision in the register: split, or accept with a reason |

A file with several distinct responsibilities, or one an agent cannot be handed a narrow task in, is RED at any
size. Never split a coherent file just because it crossed a number; never grow a file across a band without deciding
what that means for it.

## Line Length

| Chars | Action |
|---|---|
| <= 120 | preferred |
| > 140 | investigate; do not reformat mechanically |
| > 160 | never add one; wrap when the line is touched |

Advisory only: the audit reports long lines and does not fail on them. A table row, a URL or a command stays on one
line. Semantic length matters more than physical: eleven positional arguments on a short line are harder to change
than four clear lines.

Tooling enforces none of these limits today: ESLint extends only `next/core-web-vitals` (no `max-len`, `max-lines`,
`max-lines-per-function`, `max-depth` or `complexity` rule) and there is no Prettier config. Enabling one is a
separate decision: measure its blast radius first (`--long-lines`).

## Functions and Modules

| Metric | Preferred | Review |
|---|---|---|
| Function length | <= 50 lines | > 80 lines |
| Nesting depth | <= 3 levels | > 4 levels |
| Complexity | low to moderate | high |

One primary responsibility per module: no god services, controllers or components. These are judged in review.

## Exemptions

Not banded: generated code and schemas, minified and vendored assets, large static data, fixtures and snapshots,
lock files, build output, and tooling installed under `.claude/`. The audit excludes them by path glob. Test files
are banded and reported separately: `accept` is the usual decision, and a suite past ~1,000 lines is grouped into
files by describe block or fixture family. Documents follow the same bands: split a RED document by topic behind an
index. Always-on rules documents are reported by `--docs`, because every session pays their tokens.

## Register and Gate

`docs/rules/code-size-register.md` holds one row per RED file with its decision:

| Decision | Requires |
|---|---|
| `split` | a tracked issue, named in the row's notes |
| `accept` | a reason: hot path, cohesive data table, test suite, generated content |

`scripts/audit-code-size.sh` (bash 4+) bands every source file, lists RED files with and without a decision, reports
register drift, stale rows, long lines and always-on documents, and exits non-zero when a RED file has no row. Run
it before committing source changes, and wire `--summary` into `{{TEST_CMD}}` or CI so the Stop hook and CI enforce
it. Tailor only its PROJECT CONFIGURATION block (scan roots, extensions, exclusions).

A change that pushes a file into RED splits it or adds its row in the same change. Growing a registered file is
allowed: update the row's count and note, and revisit the decision. Remove a row when its file leaves RED.

```bash
scripts/audit-code-size.sh              # full report
scripts/audit-code-size.sh --summary    # counts and result: the gate
scripts/audit-code-size.sh --red        # every RED file
scripts/audit-code-size.sh --long-lines # per-file long-line counts
scripts/audit-code-size.sh --docs       # always-on rules documents
scripts/audit-code-size.sh --json       # per-file rows for tooling
```

## Splitting

Split along responsibilities (distinct features, data flows, UI sections), never at a line number, inside the
existing directory structure and naming. Update every import, carry the tests to each new module, and check for
circular dependencies. On a performance-critical path where a split adds indirection inside a tight loop, keep the
file and record an `accept` decision saying so.
