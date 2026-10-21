---
description: Update the project's agent rules (docs/rules/ and CLAUDE.md) with important new or modified rules and information.
argument-hint: <request> (string)
---
## Task
_Given the provided context and request <request>:_
1. Read `./CLAUDE.md` and the rules files it imports. Remove or correct anything outdated, incorrect or inaccurate that the request touches.
2. Put each new or changed rule in its home file, and nowhere else:
   - project facts, stack, commands, variables, architecture, security and database rules: `docs/rules/project.md`
   - issue tracking, labels, titles and pull requests: `docs/rules/github-issues.md`
   - documentation format: `docs/rules/documentation.md` (PRP documents: `docs/rules/documentation-prp.md`)
   - testing: `docs/rules/testing.md`; git: `docs/rules/git.md`; MCP tools: `docs/rules/tools.md`; file size: `docs/rules/code-size.md`
3. Keep `./CLAUDE.md` to its H1, at most two lines of orientation, and the block between the `prp-project:begin` and `prp-project:end` markers. Never edit inside the markers: the prp-project skill owns that block. Add no rules, examples or file lists to `CLAUDE.md`.
4. Write each rule as a terse imperative bullet. State a fact in one file and point to it from the others. Leave out praise, emphasis and history.
5. Report the lines added or removed per file and the change in always-on tokens (the prp-project skill's `check` prints the total).

## Why CLAUDE.md stays small

`CLAUDE.md` and every file it imports with `@` load into every session, so each line costs tokens on every task. The rules a task needs live in `docs/rules/`, and the files read only on demand are listed in the table inside the managed block.
