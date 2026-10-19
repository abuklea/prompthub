# PromptHub
## GitHub Issues and Task Tracking

| `Title` | `Created` | `Last modified` |
|---------|-----------|-----------------|
| GitHub Issues and Task Tracking | 19/10/2026 18:13 GMT+10 | 19/10/2026 22:43 GMT+10 |

## Table of Contents
- [The Rule](#the-rule)
- [Work Cycle](#work-cycle)
- [Labels](#labels)
- [Board and Milestones](#board-and-milestones)
- [Epics, Checklists and Blockers](#epics-checklists-and-blockers)
- [Titles, Commits and Pull Requests](#titles-commits-and-pull-requests)
- [Sync and Commands](#sync-and-commands)

## The Rule

GitHub Issues on `{{REPO}}` is the single tracker: every unit of work is an issue before it is a commit. Labels are
the source of truth for classification and state; structure is native (sub-issues, blocked-by relationships,
milestones), never labels. PRP documents carry the plan and the reasoning; the issue carries the state. The issue
number is the identifier: a `P#S#` or `P#S#T#` in a title cross-references the PRP, and legacy ids are frozen. A
local todo list holds the steps within one issue and never replaces filing one.

Archon is legacy and read-only until its tasks and records are imported (#29): NEVER create or update an Archon
task. Before filing during the import, search for an existing issue so no task is filed twice.

## Work Cycle

1. Find the issue (`gh issue list --label "status: ready"`), or file it first. Search before filing; never duplicate.
2. Before starting, assign yourself and set `status: in-progress`.
3. When it is built and its gates pass, set `status: in-review` with a comment on what was built, which gates ran and
   what is unverified. An agent stops here.
4. Closing is the developer's decision: a merged PR carrying `Closes #NN`, or by hand after review. Work that needs a
   human check outside CI moves to `status: awaiting-verification` at merge and is closed by hand once confirmed. An
   agent never closes an issue, least of all a `type: dev-review`.
5. Split an issue when its scope grows: file the children, list them in its task list, narrow the original.

- A PRP's issues are created at its INITIAL stage: a `type: epic`, a `type: task` per task, and a `type: dev-review`
  per check only the developer can run (a device run, a deploy, a hands-on verification).
- Session start: `git log --oneline -10`, `gh issue list --assignee "@me"`, sync, then the next `status: ready` issue
  by priority. Session end: states and boxes match reality, new scope is filed, sync is run.

## Labels

Format `<prefix>: <value>`: a lowercase prefix, a colon, one space, a kebab-case value (`size:` is upper case). No
bare labels. Per issue: exactly one `type:`, `priority:` and `status:`; at least one `area:`; at most one `size:`;
`flag:` only when it says something. Create a label before using it (`gh issue create` fails on a
missing one), and rename (`gh label edit --name`) rather than delete one in use.

| Prefix | Values |
|---|---|
| `type` | `epic`, `feature`, `task`, `dev-review` (developer-only check), `bug`, `investigation` (reproduce and attribute before a fix), `refactor`, `perf`, `test`, `docs`, `chore`, `spike` |
| `priority` | `critical` (blocks a release), `high`, `medium`, `low`: urgency, never ordering or dates |
| `status` | `backlog` (filed, not scheduled), `ready` (scoped, unblocked, next up), `in-progress`, `in-review` (built and gated, or a PR is open), `awaiting-verification` (merged; needs a human check outside CI, which covers no browser flow yet), `done` (closed) |
| `size` | `XS`, `S`, `M`, `L`, `XL`: effort, not value; `XL` splits into an epic; a PRP task is 30 minutes to 4 hours |
| `flag` | `review` (new, until triaged), `blocked`, `needs-info`, `duplicate`, `wontfix`, `good-first-issue`: beside the status, never instead of it |
| `area` | `editor`, `workspace`, `backend`, `auth`, `database`, `security`, `ui`, `infra`, `ci`, `tests`, `docs`, `perf`: each label's description in `.github/labels.json` names what it covers |

Not labels: releases and sprints (milestones), epic membership (sub-issues), "blocked" as a fact (a blocked-by
relationship, mirrored by `flag: blocked`), owners (assignees).

## Board and Milestones

- Board: `PromptHub` (Projects v2, owner `abuklea`): https://github.com/users/abuklea/projects/16.
  One column per `status:` value, in the order above.
  A closed issue is always Done and an open one never is. The Priority, Size and Area fields derive from the labels:
  change the label, never the field.
- Milestones are outcomes with due dates (`v1.0 Launch`), two to four open at a time, never categories or PRP
  phases. A scheduled issue carries one and its epic the same; backlog carries none. Close a milestone only when it
  has no open issues.

## Epics, Checklists and Blockers

- An epic lists its children as a task list, one per line (under `## Tasks` for a PRP epic):
  `- [ ] #NN P#S#T# — short title`, each linked as a native sub-issue. Two levels; one parent per issue.
- A box naming an issue is ticked when the child closes and unticked if it reopens: change the child, never the box.
  A plain-text box is ticked by the change that delivers it; an item that starts becomes its own issue.
- The first `#NN` on any checklist line reads as a child, so write any other reference in words. `Part of #NN` in a
  child documents the parent; it does not link. A parent closes only when every box is ticked.
- `Blocked by #NN` as its own sentence (`Blocked by #12, #34.`) becomes a native blocked-by relationship, and
  `flag: blocked` stays on while a blocker is open: close the blocker, never edit the flag. Prose such as "was
  blocked by #12" is history. Every block has an issue: an external wait gets a `type: spike` or `type: chore`.

## Titles, Commits and Pull Requests

- A PRP issue's title starts with its ID (`P2S8: User invites`, `P2S8T3: Invite token store [P]`, where `[P]` marks
  a parallelizable task); any other starts with its type (`[bug] …`), then a verb phrase, with no trailing period.
- PRP IDs continue from completed work; NEVER reuse one. Phases 1-6 follow `docs/project/PromptHub_06_PLAN_01.md`:
  P5S6, P6S1 and P6S2 shipped without PRPs in dd48322 (fixed in 3f3f08f, e8eed5b) and stay retired; P6S3 (#55) and
  P6S4 (#58) are open. Post-plan work is Phase 7 (P7S1 #31, P7S2 #39, P7S3 #47). Mint the next unused step after
  searching titles (`gh issue list --state all --search "P7S in:title"`), and file its epic when the ID is minted.
- A commit references issues in its body as `Refs #NN`, never with a closing keyword (`Closes`, `Fixes`,
  `Resolves`): GitHub would close the issue when the commit reaches the default branch.
- A PR carries `Closes #NN` when merging it completes the work, and `Refs #NN` when the work still needs a human
  check outside CI, and always for a `type: dev-review` issue.

## Sync and Commands

Where `.github/scripts/board-sync.sh` exists (the `adopt-github-issues` skill installs it, with `.github/labels.json`
and the issue forms), it reconciles labels, columns, PR states, sub-issue links, `flag: blocked` and checkboxes from
the developer's own `gh` login, with no GitHub Actions. Run it at session start and end and after a batch of label
edits; after one label edit, run `.github/scripts/sync-label-to-board.sh NN labeled "<label>"`. Change a label in
`labels.json` and apply it with `.github/scripts/sync-labels.sh`. Without the sync, keep all of the above true by
hand.

- GraphQL is blocked from Claude Code cloud sessions: `gh issue list`, `gh label list`, `gh repo view`, the board
  scripts and `sync-relationships.sh` fail there, and `sync-labels.sh` creates labels but its `--check` misreports.
  Use REST (`gh api repos/{{REPO}}/issues`, `.../labels`, `.../issues/NN/sub_issues`,
  `.../issues/NN/dependencies/blocked_by`) or the GitHub MCP tools, and leave board syncs to a local login.

```bash
gh issue list --label "status: ready" --state open
gh issue edit 42 --add-assignee "@me" --add-label "status: in-progress" --remove-label "status: ready"
gh issue comment 42 --body "<what was built, gates run, what is unverified>"
gh auth refresh -s project,read:project -h github.com   # the project scope board commands need
```
