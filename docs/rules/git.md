# Git Workflow

| `Title` | `Created` | `Last modified` |
|---------|-----------|-----------------|
| Git Workflow | 07/11/2025 12:46 GMT+10 | 19/10/2026 23:05 GMT+10 |

## Table of Contents
- [Branches](#branches)
- [Commands](#commands)
- [Before Committing](#before-committing)
- [Commit Messages](#commit-messages)

## Branches

| Branch | Purpose |
|---|---|
| `main` | The default branch: releasable at every commit; changes reach it only by pull request |
| `feature/<name>`, `fix/<name>`, `chore/<name>` | One unit of work, branched from `main` and merged back by pull request |

- A project with an integration branch records it in `docs/rules/project.md`, which overrides this table.
- Work on the branch your session or prompt names, and push only that branch.

## Commands

```bash
git checkout main && git pull origin main
git checkout -b feature/<name>
git add <files> && git commit          # message per Commit Messages below
git push -u origin feature/<name>
# open a pull request into main; merging it is the developer's call
```

## Before Committing

- Run `{{TEST_CMD}}`, `{{TYPECHECK_CMD}}` and `{{LINT_CMD}}`. Fix every error, re-running after each fix until clean.
- Coverage of the primary files, systems and functions is 80%+.
- Fixes introduce no new errors and break no other tests.
- Run any further checks specific to the changed files.

## Commit Messages

- Subject: `<prefix>: <summary>` on one line, then a blank line, then a lean but complete list of the changes.
- Prefixes: `feat`, `fix`, `refactor`, `remove`, `style`, `chore`, `plan`, `docs`, `assets`, `samples`, `optimise`,
  or another conventional prefix where none fits. Examples: `plan: a new feature for xyz`,
  `remove: deleted superseded implementation`, `style: theme consistency`, `chore: reverting a mistake`.
- Build the message from `git diff --staged`:

```text
fix: error from xyz fixed and feature online

  - This change
    - Issues encountered, etc.
  - That change
    - Project effect, etc.
```

- NEVER add an author, sign-off, `Co-Authored-By` or Claude Code signature line.
- Issue references in commits (`Refs #NN`, never a closing keyword) and in pull requests follow
  `docs/rules/github-issues.md#titles-commits-and-pull-requests`.
