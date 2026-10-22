# Agent Contract

| `Title` | `Created` | `Last modified` |
|---------|-----------|-----------------|
| Agent Contract | 19/10/2026 18:13 GMT+10 | 19/10/2026 23:12 GMT+10 |

## Table of Contents
- [Purpose](#purpose)
- [Read Before You Build](#read-before-you-build)
- [Rules for Every File](#rules-for-every-file)
- [Hook Traps](#hook-traps)
- [Worktrees](#worktrees)
- [Browser Checks](#browser-checks)
- [Turn Budget](#turn-budget)
- [Validation Gates](#validation-gates)
- [Final Report](#final-report)
- [Never](#never)

## Purpose

The files in `.gemini/agents/` define this project's specialists: each states a discipline, its scope here and its
method. This contract carries what every agent shares: how to start, the hook traps, worktrees, browser checks, the
turn budget and the report. `GEMINI.md` and `docs/rules/` are binding and override an agent definition wherever they
differ. The code is the authority on what exists: never trust a document's description of the codebase over what you
can read in it.

The agents and this contract are seeded by the prp-project skill and tuned to this project by `/prp-project update`;
from then on they belong to the project, and `install --force` never overwrites them.

## Read Before You Build

1. `GEMINI.md` and the rules it imports load into your context at launch: do not spend turns re-reading them. Read
   them only if they are missing from your context.
2. This file, then the task you were dispatched with: the PRP and the specs it names in `PRPs/docs/`, then the source
   they cite. Check every cited path and line number against the code: specs are written against an earlier commit.
3. On demand: `documentation-prp.md` (a PRP document), `code-size.md` (a file past 300 lines or 4,000 est. tokens).

## Rules for Every File

- The header block from `docs/rules/documentation.md#document-header` (source files:
  `docs/rules/documentation.md#source-file-headers`) on every file you create, and a changelog line in it for every
  file you edit, except the files those sections and `docs/rules/project.md#files-and-documents` exempt.
- Timestamps from the `time` tool in `{{TIMEZONE}}`, read just before you write each one: never estimated, carried
  forward from an earlier reading, or copied from another file. Without the `time` server, use the command in
  `docs/rules/tools.md#cloud-sessions`.
- Wrap code, comments, header blocks and prose at 120 characters (`docs/rules/code-size.md#line-length`). A table row, a
  URL or a command stays on one line.
- Size bands per `docs/rules/code-size.md#file-bands`: split only at a clean seam, and record any RED file in the
  register.
- No speculative abstractions, feature flags or placeholders, and no file or behaviour beyond the task's list.
- Testing per `testing.md`: write each test first and watch it fail for its own reason before the implementation
  exists. An implementation written first and moved aside to fake a red run proves nothing.

## Hook Traps

- Write files only with the Write and Edit tools, never from Bash: no `sed -i`, Python, node, perl, `printf`, `tee`,
  redirect or heredoc that writes a file. The dependency guard watches only the edit tools.
- The dependency guard refuses an edit to a coupled file (`.gemini/hooks/dependencies.json`) until you have Read the
  files it names in this session; a partial Read counts. Read them and retry; if it still blocks, stop and report.
- The secrets hook blocks any Bash, Grep or Glob call whose text names a credential file or dumps the environment:
  `.env`, `process.env`, `os.environ`, `printenv`, a bare `env |`, even inside a heredoc or a grep pattern. Never grep
  for those tokens.
- A recursive-force delete (`rm -rf`) is blocked: delete files with `rm`, then directories with `rmdir`.
- Never `cd` in Bash: the logging hook writes a `logs/` folder into the working directory of every call. Use absolute
  paths or a tool's own directory flag (`--prefix`, `-C`, `--cwd`). Before reporting, delete any stray `logs/` folder
  outside the repository or worktree root.
- The Stop hook runs `{{TEST_CMD}}` when the main session's turn ends and blocks it while the suite is red; with
  `GUARD_TEST_EDITS` on, a test file edited after a red stop fails the next green run. You finish without that
  gate: run `{{TEST_CMD}}` yourself before you report, and make every authorised edit to an existing test before
  your first red run.

## Worktrees

Agents here share the main checkout; a dispatcher asks for a worktree per dispatch, and parallel dispatches without
one touch disjoint files. An agent with `isolation: worktree` works in a fresh git worktree under `.gemini/worktrees/`:

- Its base is the dispatcher's `HEAD` where `.gemini/settings.json` sets `worktree.baseRef` to `head`, and the remote
  default branch otherwise. When your prompt names a commit, confirm `git log --oneline -1` shows it, and
  `git reset --hard <commit>` if it does not.
- Uncommitted work in the main checkout is invisible. If your task needs something missing at your base, stop and
  say so; never reimplement it.
- Run `{{INSTALL_CMD}}` from the worktree root before any gate. Git-ignored build output and media are absent: report
  any suite that needs them as not run, with that reason; never skip it silently.
- No env file is copied in. `npx prisma validate` fails without `DATABASE_URL` and `DIRECT_URL`: pass the placeholder
  values `.github/workflows/ci.yml` sets. Report a check that needs a real database or Supabase project as not run,
  except one that needs only Postgres: it runs when the dispatch supplies `TEST_DATABASE_URL` (loopback host, a
  database name containing "test"), and you create no role or database. Without it, report the check as not run.
- A language-server MCP such as Serena is rooted at the main checkout, not your worktree. Never edit through it
  there, and confirm anything you act on with Read in your worktree: its reads show the main checkout.
- Commit in your worktree only when your prompt says so; the dispatcher merges it. Finish with `git status` clean.

## Browser Checks

A headless test environment (jsdom, a null graphics device) has no layout, CSS cascade, GPU, media decoding or touch.
Verify what is drawn, gestures and media in a real browser, and say what you could not verify.

- Try the chrome-devtools tools first. Where they cannot start Chrome (common in a container running as root), that
  failure means the tool is unavailable, not that no browser is.
- Browser tooling here: the chrome-devtools server, configured per developer (`docs/rules/tools.md`); cloud sessions
  have none. The project has no Playwright and no end-to-end runner (`{{E2E_CMD}}` is `none`): without chrome-devtools,
  report the browser check as not run, for a `type: dev-review` issue. Your evidence is the snapshot or screenshot you
  read back, plus the console and network findings, in your report.
- Dev server: `npm run dev` serves the main checkout on port 3010 with HMR. Reuse a running one
  (`curl -s -o /dev/null -w '%{http_code}' http://localhost:3010`) and never start a second
  (`docs/rules/project.md#servers`). The Docker stack's gateway also binds 3010, so only one of the two runs. There is
  no port scheme for parallel agents: a worktree agent reports its browser check as not run, and the dispatcher runs
  it on 3010 after merging.
- Layouts: check the three that `src/components/layout/ResizablePanelsLayout.tsx` switches between: mobile below 768 px
  (one panel and a panel switcher; emulate touch), medium (a panel switcher, the active panel on top and the other two
  side by side below), and wide from 1440 px, or 1200 px at a 16:9
  aspect or wider (three columns). For example 390x844, 1024x768 and 1440x900.
- Targets and sign-in follow `docs/rules/project.md#dispatched-agents`: no write action (submit, save, delete) against
  a non-local target unless your prompt authorises it, and sign in only with supplied credentials or as a throwaway
  user on the local Docker stack.
- Screenshots go in your session scratchpad, never the repository; look at them with Read. A check that prints "ok"
  without reading the DOM or a screenshot proves little.
- Wait on an observable condition; a fixed wait only lets a frame render. Read the console after each check.
- Later work can make an older check stale: when one fails, establish whether the behaviour or the check changed
  before calling it a defect.

## Turn Budget

Your definition's `maxTurns` is a hard stop: at the limit you halt mid-task with no report.

- Send independent tool calls together in one message, and read only what the task needs: a symbol overview, or a
  Read with `offset` and `limit`, before a whole file. Follow a `<path>.md#<anchor>` reference by finding the
  heading's line with Grep and reading from there.
- Never loop edit, run and revert by hand: mutation testing, sweeps and repeated browser runs go through a script.
- Write the deliverable as you go. Once about four-fifths of your budget is spent, start nothing new: leave every file
  consistent (no applied mutation, no half edit), commit with a `chore: wip` subject if your prompt lets you commit, and
  report what is done and what is left.

## Validation Gates

Run every gate `.github/workflows/ci.yml` runs, from the repository or worktree root, never after a `cd`:
`npx prisma validate`, `{{LINT_CMD}}`, `{{TYPECHECK_CMD}}`, `{{TEST_CMD}}`, `bash scripts/audit-code-size.sh --summary`
and `npm run build`. The gitleaks scan runs in CI only.

- Per-file coverage: `npx vitest run --coverage --coverage.include=<file> --coverage.reporter=json-summary`, then read
  `coverage/coverage-summary.json` rather than the text table. The fixed include list in `vitest.config.ts` misses
  most changed files.
- Expected noise, not failures: Prisma's "Update available" banner (never upgrade: `docs/rules/project.md#stack`), the
  Next.js telemetry notice, Vite's "CJS build of Vite's Node API is deprecated" warning, the
  baseline-browser-mapping "over two months old" notice, and the `max-lines-per-function` warnings `npm run lint`
  reports on existing components. Your change adds no lint warning; if it cannot avoid one, stop and report why
  (`docs/rules/project.md#architecture-constraints`).

## Final Report

Your final message is the report; where the harness offers a hand-back tool (such as `SubagentHandback`), deliver the
report through it. List every file you created or modified with its line count. Paste the exact gate output lines (test
counts, coverage rows, browser check results) rather than describing them, and take counts from the suite's own totals
before and after your work, never your own tally. State every judgement call, every document that turned out to be
wrong, and what you could not verify and why. No self-praise, no marketing language, no claim of completeness you have
not evidenced.

## Never

- Commit, push, create a branch, edit or comment on a GitHub issue, or run `.github/scripts/*` unless the dispatching
  prompt says to. Another session may be working on the same branch.
- Dispatch a subagent: your tools leave out `Agent`, so hand the finding back to the dispatcher.
- Widen the scope you were dispatched with. Report an adjacent problem; do not fix it.
- Delete or rewrite a committed test, fixture or PRP report to make your work pass.
