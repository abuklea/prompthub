# Documentation Rules

| `Title` | `Created` | `Last modified` |
|---------|-----------|-----------------|
| Documentation Rules | 19/08/2025 10:00 GMT+10 | 19/10/2026 23:05 GMT+10 |

## Table of Contents
- [Writing Style](#writing-style)
- [Cross-References](#cross-references)
- [Accuracy and Honesty](#accuracy-and-honesty)
- [Drift Review](#drift-review)
- [Document Header](#document-header)
- [Timestamps](#timestamps)
- [Source File Headers](#source-file-headers)
- [Code Documentation](#code-documentation)

## Writing Style

- Write reports, documents and explanations as clear, flowing prose in complete paragraphs. Reserve markdown for
  `inline code`, fenced code blocks, simple headings (`##`, `###`) and tables. Avoid bold and italics.
- Use a list only for truly discrete items (commands, file inventories, steps, rules) or when asked. Never a run of
  short fragmentary bullets: fold the items into sentences.
- Exception: rules files (`docs/rules/`, `CLAUDE.md`) are directive references, so terse imperative bullets and
  tables are correct there.
- Markdown (`.md`) only. Every fenced code block carries its language tag (`typescript`, `bash`, `text`).
- Use tables and `mermaid` diagrams (system design, relationships, sequences, state) wherever they communicate
  better than prose, and check that each diagram renders.
- Decorate any colour a document names with that colour: `<span style="color: #FF10AE;">#FF10AE</span>`,
  `<span style="color: red;">red</span>`.
- Keep every file inside the size bands of `code-size.md`. Wrap prose where it reads better; split at a topic seam,
  never at a line number.
- Never write a secret or an environment value into a document.

## Cross-References

- Point to a section of a markdown file by its heading anchor, `<path>.md#<anchor>`: never by prose ("see the X
  section of Y") or by line number, which moves. A reader or agent then seeks the heading instead of reading the
  whole file, and a missing target is detectable.
- The anchor is GitHub's heading slug: lower case, punctuation other than `-` and `_` removed, each space a hyphen,
  `-1`, `-2` on a repeated heading. `## Hook Traps` is `#hook-traps`; `## Architecture Constraints (NEVER CHANGE)` is
  `#architecture-constraints-never-change`.
- Rules, agent and command files: a code span with the path from the repository root, such as
  `docs/rules/code-size.md#line-length`. Documents that render (READMEs, guides, PRPs, reports) and skill files: a
  link with the path relative to the linking file, such as `[Line Length](../rules/code-size.md#line-length)`; within
  one file, `[Line Length](#line-length)`.
- Rename a heading only together with every reference to it: search the repository for `#<old-anchor>` first.
- To follow a reference, find the heading's line (`grep -n '^## Line Length' docs/rules/code-size.md`) and Read from
  it with a `limit`, rather than reading the whole file.

## Accuracy and Honesty

- Document only verified facts. What you cannot confirm, leave out or mark unverified. No speculation: ask instead.
- No hedging ("it appears", "could be", "should work"): verify, then state.
- Be critical and realistic. Never oversell completeness, suitability or success; state limitations as plainly as
  capabilities.
- No praise of the developer or the work, and no blind agreement: say when a decision looks wrong, and why.
- Documentation is for developers unless told otherwise. No marketing or sales language.

## Drift Review

Every document is true of the code and the decisions in force now. Drift is a statement that has stopped being true:
a retired name, field, file, setting or step; a superseded decision left beside its replacement; a line number,
count, size or status that has moved; two documents that disagree; a reference to something that no longer exists.
Drift is a defect and is fixed like one.

- Scope: `docs/`, `PRPs/` (plans, `docs/`, `reports/`, `complete/`), `wip/`, `README.md`, `CHANGELOG.md`, `CLAUDE.md`,
  `AGENTS.md`, project skills and agents under `.claude/`, and the comments, file headers and UI text that describe
  behaviour.
- A record is not drift: a dated decision, a measurement at a stated commit, a REPORT's results. Every claim about
  the present (what the code does, what a document says, what comes next) must be true now.
- Fix by correcting or deleting, never by annotating: replace the wrong text, update `Last modified`, and add a
  changelog line where the document keeps a changelog. Git keeps the old text.
- An item outside the current change's scope gets a `type: docs` issue, never silence.

When it runs:

1. In the same change: a commit that changes behaviour, a name, a file, a field, a setting or a decision updates every
   document that describes it. Search the repository for the old term before committing.
2. PRP research: it writes a drift register for the feature's area (`wip/P#S#-research-drift.md`), each item citing
   both sides, the side that is right, and where the fix belongs.
3. PRP documents: the PRP schedules the register's fixes as a task; the INITIAL report confirms the register is
   current; the REPORT confirms every item fixed or filed and every document the PRP touched or made stale swept, and
   the PRP's `wip/` files are reconciled or deleted when it is written.
4. Session end: re-read each document edited in the session for drift it introduced.
5. Phase end: a full sweep of every document in scope, run as a `type: docs` issue.

## Document Header

Every documentation file begins with:

```text
# {{PROJECT_NAME}}
## {Document title}

| `Title` | `Created` | `Last modified` |
|---------|-----------|-----------------|
| {Document title} | {created} | {last modified} |

## Table of Contents
{a clickable anchor link to every section}
```

- Rules files in `docs/rules/` other than `project.md`, and `.claude/AGENT-CONTRACT.md`, omit the project-name line
  and start `# {Document title}`: they are identical across projects.
- `CLAUDE.md` and `AGENTS.md` carry no header block: they load every session, so they stay lean.
- Update `Last modified` on every change.

## Timestamps

- Format: `dd/MM/yyyy HH:mm` plus the GMT offset of `{{TIMEZONE}}`, e.g. `03/10/2026 14:05 GMT+10`.
- Source: the `time` MCP tool, or `TZ=<zone> date '+%d/%m/%Y %H:%M'` when it is unavailable. Never guess a time or
  copy one from another file.

## Source File Headers

Every hand-written source file and script begins with this header in the language's comment syntax (`/* */`,
a `"""` docstring, `<!-- -->`, `#`), after any shebang line:

```text
Project: {{PROJECT_NAME}}
Author: {{AUTHOR}}
Source: {relative path}
MIME: {MIME type}
Type: {language or format}

Created: {timestamp}
Last modified: {timestamp}
---------------
{file description}

Changelog:
{timestamp} | {change description}
```

- Changelog: one entry per significant change, about this file only: a timestamp and a brief summary.
- Exempt: files that cannot hold comments (JSON; JSONC such as `tsconfig.json` can), files whose first line is fixed
  by their format (YAML frontmatter in agents, commands and skills), generated code, lock files, fixtures, and
  tooling installed under `.claude/`.

## Code Documentation

- Every module: the header above, plus a top-of-file comment stating its purpose.
- Every public function, class and interface: complete doc comments in the language's standard form (TSDoc,
  docstrings, rustdoc, XML docs, Javadoc) covering purpose, parameters, return value and errors raised. Document each
  interface member: the interface is the contract that alternate implementations are written against.
- Complex logic: an inline comment prefixed `Reason:` that explains why.
- Keep `README.md` current with setup instructions and examples, and `CHANGELOG.md` for version history.
