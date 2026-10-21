# Stage 1: Research & Intelligence Gathering

Research is the foundation of a one-pass-success PRP. The executing agent cannot re-derive what was never captured, so gather everything it will need and record findings with concrete file paths, line numbers, URLs, and version numbers. Do not begin writing the PRP (Stage 2) until research is complete.

## Inputs

Read the feature request / feature file first to understand what needs to be built, how any provided examples help, and any other considerations. If a feature file exists (e.g. under `wip/` or provided by the user), it is the primary input.

## Research tracks

Run these tracks, parallelizing with subagents where the tracks are independent.

### 1. Codebase analysis

Use the project's code-intelligence tooling where it has any — a language-server MCP such as `serena` (`find_symbol`, `search_for_pattern`, `get_symbols_overview`, `find_referencing_symbols`) — and fall back to Grep/Glob.

- Search for similar features and patterns already in the codebase; identify the files the PRP should reference as patterns to mirror.
- Note existing project conventions to follow (naming, module layout, state management, API shape).
- Check existing test patterns to define the validation approach.
- Read the project's rules — `CLAUDE.md` / `AGENTS.md` and whatever they import — for rules touching the feature area, plus any current-state document the project keeps (e.g. `CONTEXT.md`).
- Identify files that will be created or modified, and check none will be pushed into the project's RED code-size band (plan splits up front if so).

### 2. Prior project context

- Search GitHub Issues for work already done or planned in this area (`gh issue list --search "<keywords>" --state all`) — an existing issue often carries the decision, the failure that motivated it, and the files touched.
- Check closed issues too, not only open ones: a superseded approach is research, and reopening a settled argument wastes the cycle.
- If the project provides an indexed knowledge base or RAG tooling, query it for the feature area — check `CLAUDE.md` / `AGENTS.md` for what it mandates. Keep queries SHORT: 2-5 keywords.
- Search the agent's own project memories (e.g. a `serena` memory store) for prior context on the feature area.

### 3. External research

Use the project's web-search and documentation-lookup tooling (e.g. `perplex`, `brave`, `ref`, `context7`), falling back to the agent's own web search:

- Library/API documentation with the SPECIFIC sections needed (capture URLs — the executing agent has web access and will follow them).
- Implementation examples from GitHub/StackOverflow/blogs.
- Best practices, latest fixes, optimal techniques, and common pitfalls for the chosen approach.
- Version compatibility: confirm the exact versions pinned in the project's manifests (`package.json`, `pyproject.toml`, lockfiles) and note quirks specific to those versions.

### 4. Prior PRPs

Scan `PRPs/` and `PRPs/reports/` for related completed work. Note dependencies on prior PRPs (needed for the footer `Dependencies` field) and reusable outcomes or lessons from their REPORT documents.

## Output of this stage

A research dossier (kept in working memory, or written to `wip/P#S#-research-notes.md` for large features) containing:

- Files to reference as patterns, with paths and why each matters.
- Documentation URLs with specific sections.
- Known gotchas: library quirks, version issues, and project-specific traps found in the codebase or its rules.
- Existing test/validation commands that actually run in this repo, taken from its own scripts and CI config.
- Candidate task breakdown and which tasks are parallelizable.
- Open questions that require user clarification — ASK them now, before generating. Never assume, presume, or guess.
