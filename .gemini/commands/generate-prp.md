# Create PRP

## Feature file: $ARGUMENTS

Where the `prp-workflow` skill is available, run its research and generate stages on this feature file: it
carries the full procedure, and the Quality Checklist below still applies. Otherwise follow the process below.

Generate a complete PRP for the feature, with thorough research. Read the feature file first: what must be built,
how its examples help, and any other considerations. The executing agent gets only the PRP and its training data,
with the same codebase access and knowledge cutoff as you, so every research finding must be included in the PRP or
referenced from it. It can search the web, so pass documentation and example URLs.

## Research Process

1. **Codebase analysis**: find similar features and patterns with the code-intelligence tools in
   `docs/rules/tools.md`. Identify the files to reference, the conventions to follow, and the existing test patterns
   to validate against. Verify every path and line you will cite.
2. **External research**: library and API documentation (with section URLs), implementation examples, best
   practices, recent fixes and common pitfalls, using the research tools in `docs/rules/tools.md`.
3. **Drift**: where `docs/rules/documentation.md` requires a drift register, write it for the feature's area.

## Imports
@docs/rules/documentation-prp.md

## PRP Generation

Use `PRPs/templates/prp_base.md` as the template, and include:

- **Documentation**: URLs with the specific sections.
- **Code examples**: real snippets from the codebase.
- **Gotchas**: library quirks and version issues.
- **Patterns**: the existing approaches to follow.
- **Implementation blueprint**: pseudocode for the approach, real files as patterns, the error-handling strategy,
  and the tasks in the order they must be completed, each assigned to an agent that exists in `.gemini/agents/`.
- **Validation gates the agent can execute**: `{{LINT_CMD}}`, `{{TYPECHECK_CMD}}` and `{{TEST_CMD}}` (values in
  `docs/rules/project.md`), plus the checks specific to the feature.

CRITICAL: after researching and exploring the codebase, and before writing, ULTRATHINK about the PRP and plan the
approach. Then write it.

## Output

Save as `PRPs/P#S#-feature-name.md`, using the next `P#S#` that is unused in both `PRPs/` and `PRPs/complete/`.

## Quality Checklist
- [ ] All necessary context included
- [ ] Validation gates executable by the agent
- [ ] References existing patterns
- [ ] Clear implementation path
- [ ] Error handling documented
- [ ] Every assigned agent exists in `.gemini/agents/`

Score the PRP from 1 to 10 for confidence of one-pass implementation success. The goal is one-pass success through
comprehensive context.
