# PRP Document Footers

| `Title` | `Created` | `Last modified` |
|---------|-----------|-----------------|
| PRP Document Footers | 21/10/2025 14:16 GMT+10 | 19/10/2026 23:05 GMT+10 |

## Table of Contents
- [Document Types](#document-types)
- [Field Order](#field-order)
- [Field Formats](#field-formats)
- [Formatting Rules](#formatting-rules)
- [Example](#example)
- [Checklist](#checklist)

## Document Types

Every PRP (Product Requirements & Planning) document ends with a footer in exactly this shape, so status,
dependencies and assignments can be parsed and tracked. FTE means the output of one full-time developer.

| Type | Location | Filename |
|---|---|---|
| PRP | `PRPs/` (`PRPs/complete/` once complete) | `P#S#-feature-name.md` |
| INITIAL (plan before execution) | `PRPs/reports/` | `P#S#-feature-name-INITIAL.md` |
| REPORT (completion summary) | `PRPs/reports/` | `P#S#-feature-name-REPORT.md` |
| WIP | `wip/` | `P#S#-description.md`, or `P#S#T#-description.md` for one task |

A footer is a snapshot taken when the document is written. Live task state is on the GitHub issues
(`github-issues.md`): where a footer and an issue disagree, the issue is right, and the footer is corrected the next
time the document is edited.

## Field Order

Fields appear in exactly this order; a number is the field's position, `-` means not used, `opt` means optional.

| Field | PRP | INITIAL | REPORT | WIP |
|---|---|---|---|---|
| Plan Status | - | 1 | - | - |
| Report Status | - | - | 1 | - |
| PRP Status | 1 | 2 | 2 | 1 |
| PRP ID | 2 | 3 | 3 | 2 |
| GitHub Issues | - | 4 | 4 | - |
| PRP Document | 3 | 5 | 5 | 3 |
| Tasks | 4 | 6 | 6 | 4 |
| Phase | 5 | 7 | 7 | 5 |
| Dependencies | 6 | 8 | 8 | - |
| Implementation Status | - | 9 | 9 | 6 |
| Testing Status | - | 10 | 10 | 7 |
| Next PRP | 7 | 11 | 11 | - |
| Documentation | - | 12 opt | - | - |
| Recommendations | 8 | 13 | - | - |
| Notes | - | - | 12 opt | 8 opt |
| Estimated Implementation Time (FTE) | 9 | 14 | - | - |
| Completed | - | - | 13 | - |

## Field Formats

| Field | Format | Example |
|---|---|---|
| Plan Status | `REVIEW` \| `ACTIVE` \| `COMPLETE` | `ACTIVE` |
| Report Status | `DRAFT` \| `FINAL` \| `ACTIVE` | `FINAL` |
| PRP Status | `TODO` \| `IN PROGRESS` \| `REVIEW` \| `COMPLETE` \| `BLOCKED` | `TODO` |
| PRP ID | `P#S#` (Phase-Step) | `P2S8` |
| GitHub Issues | the epic, the tasks with their IDs, then any `type: dev-review` issues; a REPORT adds their end state | `#41 (PRP); tasks #42-#47 (P2S8T1-P2S8T6); dev-review #48` |
| PRP Document | filename only, no folder; `.md` optional | `P2S8-user-invites` |
| Tasks | `# tasks (P#S#T# - P#S#T#)`, each a `type: task` issue titled `P#S#T#: …`; a REPORT says `# of # complete` | `6 tasks (P2S8T1 - P2S8T6)` |
| Phase | `Phase # - Description (Context)` | `Phase 2 - Accounts (API)` |
| Dependencies | `P#S# (Status), ...` or `None`; an incomplete one is also `Blocked by #NN` (its epic) in this PRP's epic | `P2S1 (Complete), P2S7 (Review)` |
| Implementation Status | INITIAL `NOT YET STARTED (P#S#)`, REPORT `COMPLETE (P#S#)`, WIP descriptive | `IN PROGRESS - 3/5 tasks complete` |
| Testing Status | INITIAL `NOT YET TESTED`, REPORT `COMPLETE (#/# tests passed)`, WIP descriptive | `COMPLETE (18/18 tests passed)` |
| Next PRP | `P#S# - Description` | `P2S9 - Billing` |
| Documentation | one project-relative path per line | `- PRPs/docs/P2S8-invite-contracts.md` |
| Recommendations | an `Agents:` list (`agent-name` (Tasks)), then a `Notes:` list | see the example |
| Notes | `-` list of results, decisions and open items | |
| Estimated Implementation Time (FTE) | `#-# hours` or `#-# days`, optional context | `25-30 hours (3-4 days)` |
| Completed | timestamp per `documentation.md` | `04/09/2026 21:25 GMT+10` |

- PRP Status follows the PRP's epic issue: `TODO` (epic `status: backlog` or `ready`; INITIAL), `IN PROGRESS`
  (`status: in-progress`; INITIAL, WIP), `REVIEW` (`status: in-review`; INITIAL, WIP), `COMPLETE` (epic closed;
  REPORT, PRP), `BLOCKED` (`flag: blocked`; any).
- Name a PRP by its filename, never its folder path: PRPs move to `PRPs/complete/`, so paths go stale, and a bare
  `P#S#` is ambiguous.

## Formatting Rules

- A line of four hyphens, `----`, separates the footer from the body.
- Each field is `**Field**: value`: bold label, colon, one space. No blank lines between fields.
- Use the exact field names, the exact (case-sensitive) enum values, and the `P#S#` / `P#S#T#` patterns.
- Timestamps follow `documentation.md`. Paths are project-relative with forward slashes.
- Agent names go in backticks, and each must exist in `.claude/agents/`.
- Lists use `-` with two-space indentation. No links are needed. The file ends with a single newline.

## Example

An INITIAL footer:

```markdown
----
**Plan Status**: ACTIVE
**PRP Status**: TODO
**PRP ID**: P2S8
**GitHub Issues**: #41 (PRP); tasks #42-#47 (P2S8T1-P2S8T6); dev-review #48
**PRP Document**: P2S8-user-invites
**Tasks**: 6 tasks (P2S8T1 - P2S8T6)
**Phase**: Phase 2 - Accounts (API)
**Dependencies**: P2S1 (Complete), P2S7 (Complete)
**Implementation Status**: NOT YET STARTED (P2S8)
**Testing Status**: NOT YET TESTED
**Next PRP**: P2S9 - Billing
**Documentation**:
- PRPs/docs/P2S8-invite-contracts.md
**Recommendations**:
Agents:
- `senior-backend-engineer` (Tasks 1-4)
- `qa-test-automation-engineer` (Tasks 5-6)
Notes:
- Invite tokens are single-use; T3 tests the replay case
**Estimated Implementation Time (FTE)**: 10-14 hours (2 days)
```

## Checklist

- [ ] `----` separator; every required field for the type, in order, with exact names
- [ ] Enum values exact; IDs match `P#S#` and `P#S#T#`; Dependencies listed or `None`
- [ ] GitHub Issues names every issue the PRP owns, and agrees with the issues' titles and states
- [ ] Timestamps in the `documentation.md` format
- [ ] Agent names in backticks and present in `.claude/agents/`
- [ ] INITIAL: Implementation `NOT YET STARTED (P#S#)`, Testing `NOT YET TESTED`, Next PRP and estimate present
- [ ] INITIAL: the PRP's drift register (`docs/rules/documentation.md#drift-review`) is current and its fixes are a task
- [ ] REPORT: Implementation `COMPLETE (P#S#)`, real test counts, each issue's end state, results in Notes, a
  Completed timestamp
- [ ] REPORT: every drift-register item fixed or filed, every document the PRP touched or made stale swept, and the
  PRP's `wip/` files reconciled or deleted
- [ ] PRP: Recommendations and estimate present
- [ ] WIP: descriptive statuses, and Notes that explain the current state
- [ ] No blank lines between fields; a single trailing newline
