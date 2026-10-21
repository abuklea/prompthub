# Stage 5: Initial Pre-Execute Report (*-INITIAL.md)

The INITIAL report is the execution plan of record and a MANDATORY gate: execution (Stage 6) must not begin until this report exists and is accurate. It is written after the PRP has passed review (score >= 8) and is saved as `PRPs/reports/P#S#-feature-name-INITIAL.md`.

## Purpose

The report condenses the PRP into an actionable execution plan: what will be built, in what order, by which agents, with what parallelization, and what the risks are. It is also the point where the PRP's GitHub issues are created.

## Content sections

Apply the standard document scaffolding (source header, headings, title table, ToC — see SKILL.md Conventions), then:

**Review Status** — how the PRP reached this point: `REVIEWED (score N/10)`, or `SKIPPED (self-score N/10)` followed by the justification. This is the auditable record the review-skip gate requires (SKILL.md, "Skipping the review loop"); without it the decision has nowhere to live.

**Overview** — what this PRP implements, as a short numbered summary of the feature's major parts.

**Research Summary** — the load-bearing findings: existing infrastructure and files that will be built upon (with paths), key patterns identified (and what to mirror), new schema/data structures, and access-control or behavioural rules (tables work well for permission matrices).

**Task Breakdown** — table of every task: Task ID (`P#S#T#`), description, assignee (most-aligned subagent), `[P]` parallel marker, and the GitHub issue number once created (see below).

**Parallelization Strategy** — explicit execution phases showing sequential chains (`T1 → T2 → T3`) and parallel groups, with the reason (e.g. "backend foundation must precede frontend integration").

**Dependencies** — libraries/packages needed (note which are already installed) and prerequisite PRPs with their status.

**Risk Assessment** — table of risk → mitigation for the genuinely risky parts.

**Success Criteria** — checklist mirroring (and refining) the PRP's success criteria.

**Estimated Timeline** — per-phase hour estimates and an FTE total consistent with the PRP footer.

**Footer** — INITIAL-report footer per the project's documentation rules: Plan Status, PRP ID, GitHub Issues (the issue numbers created below), PRP Document path, Tasks, Phase, Dependencies, Next PRP, Documentation, Recommendations (agents + notes), Estimated Implementation Time (FTE).

The footer is a **write-time snapshot** and nothing in the workflow updates it afterwards, so it carries no lifecycle field that would go stale: progress lives on the issues, and completion is recorded in the REPORT. That is why there is no `Implementation Status` or `Testing Status` here — a document field saying `NOT YET STARTED` forever is exactly the hand-maintained status this workflow keeps out of documents.

## Issue creation

Create the GitHub issues now, one per task in the breakdown, then write their numbers back into the Task Breakdown table and the footer — the report and the board must be readable against each other.

Read [task-tracking.md](task-tracking.md) and follow its "Creating a PRP's issues" section — the preconditions, the label scheme, the epic, the title and body requirements, the verification gates and the exact `gh` commands all live there and are not restated here.
