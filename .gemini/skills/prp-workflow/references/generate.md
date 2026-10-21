# Stage 2: Generate PRP

Prerequisite: Stage 1 research is complete (see research.md). Before writing anything, THINK HARD about the PRP: plan the implementation approach end-to-end, then write the document in one coherent pass.

## Template and structure

Use the project's PRP template if it has one (commonly `PRPs/templates/prp_base.md`); otherwise the required sections below ARE the structure. Save the output as `PRPs/P#S#-feature-name.md`.

Core principles:

1. **Context is King** — include ALL necessary documentation, examples, and caveats.
2. **Validation Loops** — provide executable tests/lints the executing agent can run and fix against.
3. **Information Dense** — use keywords and patterns from the actual codebase.
4. **Progressive Success** — start simple, validate, then enhance.
5. **Global rules** — the PRP must comply with the project's own rules (`CLAUDE.md` / `AGENTS.md` and what they import).

Wrap the body in the mandatory document scaffolding (see SKILL.md Conventions): HTML-comment source header, `# {Project name}` / `## P#S# – {Feature Title}` headings, title table, and a Table of Contents linking the major sections (Goal, Why, What, All Needed Context, Implementation Blueprint, Task List, Validation Loop, Final Validation Checklist, Anti-Patterns to Avoid).

## Required sections

**Goal** — what needs to be built; be specific about end state.

**Why** — business value, integration with existing features, problems solved and for whom. Written as prose.

**What** — user-visible behaviour and technical requirements, with a `Success Criteria` checklist of specific measurable outcomes.

**All Needed Context** — the payload that makes one-pass success possible:
- Documentation & references as a YAML list: `url:`/`file:`/`doc:`/`docfile:` entries each with `why:` (and `critical:` for key insights). Real paths and real URLs from Stage 1 only.
- Current codebase tree (relevant subtree) and desired tree showing files to add with each file's responsibility.
- Known gotchas of THIS codebase and the specific library versions it pins, as a commented code block — the traps Stage 1 actually found, never a generic list.

**Implementation Blueprint**:
- Data models and structure first, in whatever form this stack uses (ORM models, schemas/validators, static types).
- Ordered task list (`Task 1 ... Task N`) in execution order, using MODIFY/CREATE/FIND/INJECT/MIRROR/PRESERVE verbs against real file paths. Mark parallelizable tasks with `[P]`. Size tasks at 30 min – 4 hours each.
- Per-task pseudocode where needed — CRITICAL details only, referencing real files for patterns (`# PATTERN:`, `# GOTCHA:`, `# CRITICAL:` comments), never full code.
- Integration points: database migrations, config entries, route registrations, env vars.
- Error handling strategy.

**Validation Loop** — executable gates in escalating levels, using commands that actually run in this repo. Take them from the project's own scripts (`package.json`, `Makefile`, `pyproject.toml`, CI config), never from this skill — a command that does not exist here is worse than no command:

```text
# Level 1 - syntax/style      → the project's lint and format check
# Level 2 - unit tests        → the project's test runner, plus the concrete cases to create
# Level 3 - integration       → the project's integration environment, plus concrete
#                               curl / browser verification steps
```

**Final Validation Checklist** — all tests pass, no lint/type errors, manual verification step, error cases handled, no file over the project's length limit, docs updated.

**Anti-Patterns to Avoid** — the project's own standing list plus feature-specific ones discovered in research.

**Footer** — main-PRP footer per the project's documentation rules: PRP Status, PRP ID, Tasks count/range, Phase, Dependencies, Next PRP, Recommendations (agents in backticks with task ranges, plus notes), Estimated Implementation Time (FTE). The task issues do not exist yet at this stage — they are created at Stage 5, and their numbers are recorded there.

## Scoring

End the generation by scoring the PRP 1-10: confidence level that an agent succeeds in one-pass implementation using only the PRP. State the score and its justification to the user. A score below 8 means Stage 3 review must produce concrete gaps to fix before execution.

A self-score of >= 8/10 with no open blockers is ONE precondition for skipping Stages 3-4 — the full gate is in SKILL.md, "Skipping the review loop". The self-score must be honest: reaching 8 requires that every file path and documentation URL was verified against the repo during generation and that no task leaves the executing agent to guess. Do not inflate the score to justify a skip.
