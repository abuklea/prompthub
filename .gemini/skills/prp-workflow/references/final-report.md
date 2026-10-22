# Stage 7: Work Review & Final Report (*-REPORT.md)

The final stage has two parts: an honest review of the completed work, then the completion report at `PRPs/reports/P#S#-feature-name-REPORT.md`. The report documents what was ACTUALLY built and verified — never aspirational claims.

## Part 1: Work review

Before writing anything, verify the implementation against the PRP:

- Re-read the PRP's Success Criteria and Final Validation Checklist; check each item against the real codebase, not memory.
- Re-run the full validation suite fresh (lint, typecheck, unit tests, integration) using the project's own commands, and capture actual pass/fail counts — the footer requires them.
- Run the project's code-size audit if it has one; confirm no RED file lacks a decision in the project's code-size register.
- Diff-review the changed files: confirm no placeholders, mocks, workarounds, dead code, or commented-out blocks slipped through; confirm patterns match the PRP's blueprint.
- List the actual commits (`git log --oneline`) touching this PRP.
- Confirm every GitHub issue for the PRP is at `status: in-review`, `status: awaiting-verification` or closed (see [task-tracking.md](task-tracking.md)). Anything not finished must be reported as such — never over-estimate completion status.

Where a criterion fails, either fix it now (small) or record it honestly in the report as incomplete/deviated (large). A report that claims completeness it cannot prove is a rule violation.

## Part 2: Completion report content

Apply the standard document scaffolding (source header, headings, title table, ToC — see SKILL.md Conventions), then:

**Overview** — what the PRP implemented, numbered by major feature part (mirrors the INITIAL report's overview, restated as delivered outcomes).

**Implementation Summary** — the substance, organized by the layers this project actually has (backend / frontend / pipeline / etc.): schema migrations named the way this project's migration tool names them, data-model changes, API changes, new and updated components with paths, type changes. Prose plus targeted lists; concrete names and paths throughout.

**Commits** — the actual commit hashes and messages.

**Verification Results** — build verification (typecheck/lint/migration status) and a feature verification table mapping each feature to its status. Include behavioural matrices (e.g. access-control) where the feature has rule tables. Report test counts truthfully — `COMPLETE (12/12 tests passed)` or the real fraction.

**Files Changed** — complete list, grouped by layer, each marked NEW or UPDATE.

**Notes** — non-obvious facts future developers need: compatibility decisions, any client-side state or storage keys introduced, security behaviours, auto-correction logic, known limitations, and any deviations from the PRP with their rationale.

**Footer** — REPORT footer per the project's documentation rules: Report Status (`FINAL` when done), PRP Status `COMPLETE`, PRP ID, GitHub Issues (the numbers, with their end state), PRP Document path, Tasks (count, range, completion state), Phase, Dependencies, Implementation Status `COMPLETE (P#S#)`, Testing Status with real counts, Next PRP, notes, and a `Completed` timestamp in the project's timestamp format.

## Closing the cycle

- Update the main PRP's footer `PRP Status` to `COMPLETE` (with Changelog entry and refreshed `Last modified`).
- Update the project's current-state document with the completion, and its rules file if new patterns or dependencies were introduced.
- **Archive the PRP** — move it out of the in-flight folder so the ID-allocation listing in SKILL.md reflects reality: `git mv PRPs/P#S#-*.md PRPs/complete/`. The reports stay where they are. Nothing else in the workflow writes to that folder, so skipping this step is what makes a future `P#S#` collide.
- Optionally move superseded working files out of the working-notes directory, and note the `Next PRP` so the following cycle can pick up dependencies.
