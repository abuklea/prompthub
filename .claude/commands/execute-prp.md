# Execute BASE PRP

Implement a feature using the PRP file.

## PRP File: $ARGUMENTS

Where the `prp-workflow` skill is available, run its execute stage on this PRP: it carries the full procedure,
and the Mandatory Rules below still bind. Otherwise follow the process below.

## Execution Process

1. **Load PRP**
   - Read the PRP file and understand all its context and requirements.
   - Follow every instruction in it, and extend the research (web search, codebase exploration) until you have all
     the context needed to implement it fully.

2. **ULTRATHINK**
   - Think hard before executing, and plan for every requirement.
   - Break complex work into small, manageable steps, tracked in the session's task list where it has one.
   - Identify the existing implementation patterns to follow.

3. **Execute the plan**: dispatch each task to its agent and integrate the results.

4. **Validate**: run each validation command, fix any failure, and re-run until all pass. When validation fails,
   use the error patterns in the PRP.

5. **Complete**: confirm every checklist item, run the final validation suite, re-read the PRP to confirm everything
   is implemented, and report the completion status.

Reference the PRP again whenever needed.

## Imports
@docs/rules/documentation-prp.md

## Mandatory Rules

- FIRST: confirm the PRP's INITIAL report (`PRPs/reports/*-INITIAL.md`) exists, is accurate and is current; create
  it if it does not.
- Track every task as a GitHub issue per `docs/rules/github-issues.md`, with the titles, labels and states it defines:
  `status: in-progress` before starting, `status: in-review` when built and the gates pass. Use `gh`, or the GitHub
  MCP tools where `gh` is not authenticated. Keep the issues in step with the PRP. Never create a duplicate: search
  first.
- Size tasks at 30 minutes to 4 hours, and so one agent can finish one within its turn budget; factor larger work into
  the smallest self-contained tasks.
- Mark parallelizable tasks `[P]` and run them as concurrent subagents.
- Assign every task to the most suitable agent in `.claude/agents/`, with a lean but complete brief: the goal and
  success criteria, with error-handling and fallback guidance; the context, files and patterns; dependencies and
  prerequisite work; sequence, scope and codebase influence; references to project documents and external sources;
  an instruction to read `.claude/AGENT-CONTRACT.md`; and an instruction to share notes as markdown in `wip/`.
- Before dispatching a worktree agent, commit the work it builds on and name that commit in its brief: uncommitted
  work never reaches a worktree, and without `worktree.baseRef: head` in `.claude/settings.json` the harness branches
  it from the remote default branch.
- After merging an agent's work, re-run every gate on the merged tree, and take test counts from the suite's totals,
  never from the agent's report.
- No mock or dummy data. No placeholder components, systems, code or data, ever. No backwards-compatibility shims,
  bypassed or disabled features, or temporary workarounds: real data, real operations, production-ready code only.
- Never assume, presume or guess: ask when in doubt. Verify file paths and module names before use.
- A task is complete only when it is fully implemented, integrated, tested and working within the platform. Never
  overstate progress: the developer decides when work is done.
- Keep `CLAUDE.md` and `docs/rules/project.md` current when adding patterns or dependencies.
- Test your code, and document your decisions for the team and future contributors.
