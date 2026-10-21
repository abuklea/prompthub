# Stages 3-4: Review PRP, Regenerate Improved PRP

Review is adversarial, not a rubber stamp. The reviewer's job is to find the gaps that would break a one-pass implementation. Run a review after every generation and after every regeneration, looping until the PRP scores at least 8/10.

**This loop is skippable when research and planning are already sufficient** — the gate is in SKILL.md, "Skipping the review loop", and is not restated here. When it is skipped, record the skip, the self-score and the justification in the Stage 5 INITIAL report's Review Status field.

## Stage 3: Review

Review the PRP from the perspective of a fresh agent that has ONLY the PRP and codebase access — no memory of the research conversation. For thorough reviews, spawn an independent subagent (a general-purpose or architecture-review agent from `.gemini/agents/`) with exactly that framing: "Attempt to plan the implementation using only this PRP; report every point where you would have to guess."

### Review rubric

Score each dimension, then give an overall 1-10 one-pass-success confidence score.

1. **Context completeness** — Are all referenced files real (verify paths exist)? Are documentation URLs specific to the needed sections? Would the agent need any fact that is not in the PRP? Are gotchas that research uncovered actually written down?
2. **Implementation clarity** — Is the task list ordered, complete, and unambiguous? Does each task name real files with concrete MODIFY/CREATE directives? Is pseudocode present where logic is non-obvious? Are data models defined before their consumers?
3. **Validation executability** — Can every validation command be run verbatim in this repo (correct directories, correct scripts)? Do the gates escalate lint → unit → integration? Are concrete test cases specified?
4. **Architecture & rules compliance** — the project's code-size bands respected in the desired tree (no file pushed into its RED band without a recorded decision); correct module boundaries and naming conventions; every standing rule in the project's own rules files that touches this feature area (data access, auth, typing policy) actually honoured; no speculative complexity.
5. **Task/agent mapping** — Are tasks 30 min – 4 hours each, `[P]` markers correct (genuinely independent), assignees drawn from the subagents this project actually has (`.gemini/agents/`), dependencies between tasks explicit?
6. **Document standards** — Header, ToC, footer fields, and timestamps conform to the project's documentation rules (run its validation checklist where it has one), and the project name in the headings is this project's.
7. **Risk coverage** — Error handling strategy present; edge cases and failure modes identified; anti-patterns section covers the feature's real temptations.

### Review output

Produce a findings list, each finding with: dimension, severity (blocker / should-fix / nit), the specific PRP location, and the concrete fix. Blockers are anything that would force the executing agent to guess or that violates project rules. Report the overall score with justification. Be critical and realistic — do not over-sell the PRP's readiness.

## Stage 4: Regenerate

Apply the review findings to produce the improved PRP. This is an edit of the same `PRPs/P#S#-feature-name.md` file, not a new file.

- Resolve every blocker and should-fix; resolve nits unless they conflict with a rule.
- Where a finding needs new information, go back to Stage 1 techniques (code intelligence, issue history, knowledge base, external research) rather than papering over the gap with vague wording.
- Keep improvements surgical — do not rewrite sections that passed review, and do not grow the document with padding; density beats length.
- Update the source header's `Last modified` timestamp and append a Changelog entry describing the revision (real time from a real clock — a `time` MCP tool where available, else `date`).
- Re-score, then loop back to Stage 3. Exit the loop when the score is >= 8/10 and no blockers remain; report the final score to the user before proceeding to Stage 5.
