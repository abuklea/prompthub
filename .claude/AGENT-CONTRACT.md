# Agent Contract

| `Title` | `Created` | `Last modified` |
|---------|-----------|-----------------|
| Agent Contract | 19/10/2026 18:13 GMT+10 | 19/10/2026 18:13 GMT+10 |

## Table of Contents
- [Purpose](#purpose)
- [Read Before You Build](#read-before-you-build)
- [Rules for Every File](#rules-for-every-file)
- [Hook Traps](#hook-traps)
- [Worktrees](#worktrees)
- [Validation Gates](#validation-gates)
- [Final Report](#final-report)
- [Never](#never)

## Purpose

Each file in `.claude/agents/` describes a discipline, not this project. This contract and the rules it points to
carry the project specifics, so agent files stay portable. `CLAUDE.md` and `docs/rules/` are binding and override
your agent definition wherever they differ. The code is the authority on what exists: never trust a document's
description of the codebase over what you can read in it.

## Read Before You Build

1. This file.
2. `CLAUDE.md` and every file it imports with `@`, unless they are already in your context: `docs/rules/project.md`
   (brief, layout, stack, `{{VARIABLES}}`, constraints), `github-issues.md`, `documentation.md`, `testing.md`,
   `git.md`, `tools.md`.
3. The PRP or task you were dispatched with, and every contract it names in `PRPs/docs/`.
4. On demand: `documentation-prp.md` (PRP documents), `code-size.md` (file size).

## Rules for Every File

- The header block from `documentation.md` on every source and documentation file, and a changelog line in it for
  every file you edit.
- Timestamps from the `time` tool in `{{TIMEZONE}}`; never guessed or copied from another file.
- Size bands per `code-size.md`: split only at a clean seam, and record any RED file in the register.
- No speculative abstractions, feature flags or placeholders.
- Testing per `testing.md`. The Stop hook runs `{{TEST_CMD}}` when a turn ends and blocks on red, so write new
  tests before your first stop, never edit a committed test to pass, and report what a headless environment could
  not verify.

## Hook Traps

- The secrets hook blocks any Bash, Grep or Glob call whose text names a credential file or dumps the environment:
  `.env`, `process.env`, `os.environ`, `printenv`, a bare `env |`, even inside a heredoc or a grep pattern. Write
  files with the Write and Edit tools, never shell heredocs, and never grep for those tokens.
- A recursive-force delete (`rm -rf`) is blocked: delete files with `rm`, then directories with `rmdir`.
- Never `cd` in Bash: the logging hook writes a `logs/` folder into the working directory of every call. Use absolute
  paths or a tool's own directory flag (`--filter`, `--cwd`, `-C`).
- Before reporting done, delete any stray `logs/` folder outside the repository root.

## Worktrees

An agent with `isolation: worktree` starts in a fresh git worktree at the last commit:

- Dependencies are not installed: run `{{INSTALL_CMD}}` from the worktree root before any gate.
- Uncommitted work in the main checkout is invisible. If your task depends on it, stop and say so; never
  reimplement it.
- Git-ignored build output and media are absent. Report any suite that needs them as not run, with that reason;
  never skip it silently.

## Validation Gates

Run from the repository root, never after a `cd`: `{{LINT_CMD}}`, `{{TYPECHECK_CMD}}`, `{{TEST_CMD}}`, and
`{{E2E_CMD}}` where one is defined.

## Final Report

List every file you created or modified with its line count. Paste the exact gate output lines (test counts,
coverage summary, end-to-end result) rather than describing them. State every judgement call, every document that
turned out to be wrong, and what you could not verify and why. No self-praise, no marketing language, no claim of
completeness you have not evidenced.

## Never

- Commit, push, create a branch or edit a GitHub issue unless the dispatching prompt says to. Another session may
  be working on the same branch.
- Spawn a subagent: subagents cannot dispatch subagents, so hand the finding back instead.
- Widen the scope you were dispatched with. Report an adjacent problem; do not fix it.
- Delete or rewrite a committed test, fixture or PRP report to make your work pass.
