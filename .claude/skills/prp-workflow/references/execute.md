# Stage 6: Execute the PRP

Implement the feature exactly as specified by the PRP, using the INITIAL report as the execution plan and the PRP's GitHub issues as the live task tracker. Read [task-tracking.md](task-tracking.md) for the label scheme and commands.

## Execution process

1. **Gate check** — Confirm `PRPs/reports/P#S#-*-INITIAL.md` exists and is accurate/current. If it does not exist, create it first (Stage 5). Confirm the PRP's issues exist and that `gh auth status` is clean.

2. **Load PRP** — Read the full PRP. Understand all context and requirements. Follow all instructions in it and extend the research if needed: do more codebase exploration (serena) and web searches until nothing about the implementation requires guessing.

3. **Plan hard before executing** — Think deeply and produce a comprehensive plan addressing all requirements. Break complex work into the PRP's task structure, identify implementation patterns from existing code to follow, and confirm the parallelization phases from the INITIAL report.

4. **Execute tasks** — For each task, in plan order:
   - Move the issue through its states per task-tracking.md, "Working the issues" — that file owns the tracker mechanics.
   - Dispatch to the task's assigned subagent. Spawn `[P]`-marked tasks' subagents concurrently in a single message. Pass each subagent detailed context (PRP path, issue number, task description, relevant files, patterns to mirror, validation commands) — robust communication and context integrity are the caller's responsibility.
   - Implementation must be complete, robust, integrated, and tested — the feature working correctly broadly within the platform — before the task moves on.

5. **Validate** — Run every validation command from the PRP's Validation Loop (lint → unit → integration). Fix failures using the error patterns documented in the PRP and re-run until all pass. Use the project's own integration environment for integration verification, exactly as the project's rules specify it.

6. **Complete** — Work through the PRP's Final Validation Checklist. Re-read the PRP end-to-end to confirm every requirement is implemented. Run the final validation suite and the project's code-size audit if it has one. Report completion status honestly — the PRP remains the reference at all times.

## Hard rules during execution

- NO mock/dummy data, NO placeholder components/systems/code/data, NO temporary workarounds, NO backwards compatibility shims. Where the project has a datastore, use it for real rather than stubbing it; production-ready code only.
- NEVER assume, presume, or guess — when in doubt, ask the developer.
- NEVER "work around" a problem — implement the real, targeted solution.
- No feature is complete without passing tests (TDD; meet the project's coverage bar). Never weaken or mock a test just to pass it.
- Never over-state progress: implementation is not "complete" until validated, and issues stay open at `status: in-review` (or `status: awaiting-verification`) until the developer confirms.
- Always verify file paths and module names before use.
- Keep every touched file within the project's code-size bands; a file pushed into RED is split along responsibilities per its architecture rules, or given a register decision, in the same change.
- Commit incrementally, using the project's commit message convention (`feat(scope): description (P#S#)` where it defines none); reference the issue in the branch name and PR body; run lint/typecheck before each commit; never commit secrets.
- Update the project's rules file when adding new patterns or dependencies, and its current-state document after structural changes.
- Document decisions for the dev team; working notes shared between agents go in `wip/`.

## When execution deviates from the PRP

If reality forces a change (API mismatch, unforeseen constraint), do not silently diverge: update the PRP (with Changelog entry) and correct the affected issues — edit the body, or comment the correction — so no issue describes an approach that was abandoned. Note the deviation for the final report. If the deviation is architecturally significant, stop and ask the developer first.
