# Task tracking: GitHub Issues

Every task in a PRP is a GitHub issue, and issues are the single source of truth for task state — never TodoWrite, and never a hand-maintained status column in a document while the tracker is reachable (see the Preconditions below for the one exception).

This file is the whole tracker contract. SKILL.md and the stage references point here rather than restating any of it.

Read this before Stage 5 (issue creation), Stage 6 (execution) and Stage 7 (the completion check).

## If the project documents its own taxonomy, that file wins

Look for a project rules file on task tracking (commonly `docs/rules/github-issues.md` or `docs/rules/issue-tracking.md`, or a "Task tracking" section in `CLAUDE.md` / `AGENTS.md`) and for a label manifest at `.github/labels.json`. Where they define label names, a board, or issue-body requirements, follow them and ignore the defaults below. This file only defines what is specific to a PRP: how a PRP's task breakdown maps onto issues.

The defaults below follow the shared `adopt-github-issues` standard: labels spelled `<prefix>: <value>` (a colon and ONE space), a PRP as an epic issue whose tasks are its native sub-issues, and a local `.github/scripts/board-sync.sh` in place of GitHub Actions. A repository still on an older spelling (`status:ready`, no space) keeps working: use the label names `gh label list` actually shows.

## Preconditions

Run both before Stage 5 creates anything:

1. **`gh auth status`** — confirm the CLI is authenticated against the right repo.
2. **`gh label list`** — confirm every label the issues will carry already exists. `gh issue create` **fails** on a label the repo does not have; it does not silently drop it, so one missing label stops Stage 5 on its first task. Create the missing ones, or ask the developer to:

```bash
gh label list --limit 200
.github/scripts/sync-labels.sh --check          # where the repo has a labels.json manifest
gh label create "status: ready" --color 1D76DB --description "Board column: scoped, unblocked, next up"
```

**If `gh` is unavailable or unauthenticated**, say so explicitly and fall back: add a `Status` column to the INITIAL report's Task Breakdown table, marked in the report as a temporary stand-in, and reconcile it into real issues once `gh` works. Never silently skip tracking.

## Default label scheme

Used when the project defines none of its own.

| Prefix | Values | Meaning | Set by |
|--------|--------|---------|--------|
| `status: ` | `ready`, `in-progress`, `in-review` | where the task sits in the flow | this skill |
| `status: ` | `awaiting-verification` | merged, waiting on a check only the developer can run | this skill (at merge) |
| `status: ` | `backlog` | deferred, not yet scheduled | the developer |
| `status: ` | `done` | applied on close by the sync | the sync |
| `type: ` | `epic` for the PRP, `task` (or `test`, `docs`, `refactor`...) for each task | what kind of work | this skill |
| `priority: ` | `critical`, `high`, `medium`, `low` | urgency | this skill |
| `area: ` | the project's own areas | which subsystem | this skill |
| `size: ` | `XS` … `XL` | effort | this skill |

The PRP itself is not a label: it is the **epic issue**, and its tasks are the epic's sub-issues. Never add a `feature:` or PRP-id label. Which assistant drives the work goes in the project's own axis where it has one (for example `agent: claude`).

Status flow: `status: ready` → `status: in-progress` → `status: in-review` → **closed**, or → `status: awaiting-verification` when the merge does not finish the work.

An agent moves an issue only as far as `status: in-review` (or `status: awaiting-verification`) and then stops. **Closing is the developer's call** after review — an issue at `status: awaiting-verification` is a manual check an agent must never close.

Change the **label**, never the card. Where the repo has `.github/scripts/`, run `.github/scripts/sync-label-to-board.sh <N> labeled "<label>"` straight after a status change: the board sweep treats the card's column as the truth for an open issue, so an unsynced label change is reverted by the next sweep.

## Creating a PRP's issues (Stage 5)

First ONE epic issue for the PRP, then one issue per task in the INITIAL report's task breakdown, plus one per developer-only verification (see verification gates below).

- **Search first** — `gh issue list --search "<keywords>" --state all`. Never open a duplicate for work an existing issue already covers; update that issue instead.
- **The epic** — title `[epic] <Feature title>`, labels `type: epic`, `status: backlog` (or `ready`), `priority:`, `area:`. Body first line `PRP: <PRP filename>`, then an Outcome paragraph, then `### Child issues` with a task list filled in once the tasks exist, then exit criteria.
- **Title** of each task is a plain `[task] Verb phrase` (or `[test]`, `[docs]`...) with NO PRP or task id in it. The issue NUMBER is the only identifier.
- **Body first line** carries the cross-reference back to the PRP: `PRP: <PRP filename> T3`, adding `(parallelizable)` where the task is `[P]`. `gh issue list --search "P44S1" --state all` still finds every task, because search covers bodies.
- **Order** lives in the epic's task list, one `- [ ] #NN Title` line per task in execution order. After the tasks exist, edit the epic body to add the list, then run `.github/scripts/sync-relationships.sh --issue <epic>` (or `board-sync.sh`) where the repo has it: it links each line as a native sub-issue and ticks the box when the child closes.
- **Body** carries a lean-but-complete foundation, so the assigned agent can start without asking: goal and success criteria with error-handling and fallback guidance; the context, files and patterns that bear on it; `Part of #<epic>.` and dependencies as their own line, `Blocked by #123.` (the sync turns it into a native blocked-by link and sets `flag: blocked` while the blocker is open); intended sequence, scope and codebase influence; references to the PRP path and any external sources; and, where relevant, an instruction to share markdown notes in the project's working-notes directory.
- **Labels** — one `status: ready`, one `type:`, one `priority:`, at least one `area:`, a `size:`, and the project's `agent:` label where it has that axis. Name the chosen subagent in the body.
- **Size** each at 30 minutes – 4 hours. Split anything larger.
- **Verification gates** — where the PRP's Final Validation Checklist contains a step only the developer can run (a real-device pass, a browser verification, a manual data check), raise it as its own issue with `type: test` and a title that starts with `Verify`, listed last in the epic's task list. Without this the gate exists in the rules but nothing ever creates one, and the verification silently has no home.

```bash
gh issue create --title "[epic] LOD streaming pipeline" --body-file <notes-dir>/P44S1-epic.md \
  --label "type: epic" --label "status: backlog" --label "priority: medium" --label "area: conversion"
gh issue create --title "[task] Description" --body-file <notes-dir>/P44S1T3-body.md \
  --label "type: task" --label "status: ready" --label "priority: medium" --label "area: conversion" --label "size: S"
gh issue edit <epic> --body-file <notes-dir>/P44S1-epic.md     # now with the - [ ] #NN task list
.github/scripts/sync-relationships.sh --issue <epic>            # link the sub-issues, where present
```

Record each created issue number, and the epic's, in **both** places the INITIAL report requires it: the Task Breakdown table row and the footer's `GitHub Issues` field.

## Working the issues (Stage 6)

- Move to `status: in-progress` **before** starting the work, not after.
- On success, move to `status: in-review` and comment what was built, which gates were run, and what remains **unverified**. Leave it open.
- Keep the board synchronized with reality continuously, not in a batch at the end.

```bash
gh issue edit <N> --remove-label "status: ready" --add-label "status: in-progress"
.github/scripts/sync-label-to-board.sh <N> labeled "status: in-progress"     # where present
gh issue edit <N> --remove-label "status: in-progress" --add-label "status: in-review"
.github/scripts/sync-label-to-board.sh <N> labeled "status: in-review"
gh issue comment <N> --body "<what was built, gates run, what is unverified>"
```

Reference the issue in the branch name and the PR body so GitHub threads the commits onto it. Use `Closes #N` in a PR body only where the merge genuinely finishes the work. Work that still needs a developer check is not finished by a merge: its PR says `Refs #N`, and the issue moves to `status: awaiting-verification` when the PR merges. Keep closing keywords out of commit messages.

## Deviations and completion

If reality forces a change to the plan, update the affected issues' bodies (or comment the correction) alongside the PRP's own Changelog entry — an issue describing an approach that was abandoned is worse than no issue.

At Stage 7, confirm every issue for the PRP is at `status: in-review`, `status: awaiting-verification` or closed, and that the epic's task list matches its sub-issues. Anything unfinished is reported as unfinished; never over-state completion.
