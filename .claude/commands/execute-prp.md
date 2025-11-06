# Execute BASE PRP

Implement a feature using using the PRP file.

## PRP File: $ARGUMENTS

## Execution Process

1. **Load PRP**
   - Read the specified PRP file
   - Understand all context and requirements
   - Follow all instructions in the PRP and extend the research if needed
   - Ensure you have all needed context to implement the PRP fully
   - Do more web searches and codebase exploration as needed

2. **ULTRATHINK**
   - Think hard before you execute the plan. Create a comprehensive plan addressing all requirements.
   - Break down complex tasks into smaller, manageable steps using your todos tools.
   - Use the TodoWrite tool to create and track your implementation plan.
   - Identify implementation patterns from existing code to follow.

3. **Execute the plan**
   - Execute the PRP
   - Implement all the code

4. **Validate**
   - Run each validation command
   - Fix any failures
   - Re-run until all pass

5. **Complete**
   - Ensure all checklist items done
   - Run final validation suite
   - Report completion status
   - Read the PRP again to ensure you have implemented everything

6. **Reference the PRP**
   - You can always reference the PRP again if needed

Note: If validation fails, use error patterns in PRP to fix and retry.

## Imports
@docs/rules/documentation.md
@docs/rules/documentation-prp.md

### Important Notes

- **FIRST STEP**: Ensure the PRP start report has been created and is accurate and current. If it does not exist, create it
- **CRITICAL**: Follow the definitive Archon process
- Task status flow: `todo` → `doing` → `review` → `done`
- Keep queries SHORT (2-5 keywords) for better search results
- Higher `task_order` = higher priority (0-100)
- Tasks should be 30 min - 4 hours of work
- Split tasks or related collections of tasks, and factor into smallest discrete self-contained tasks (where possible and optimal)
- **Parallelize tasks** where possible using subagents and the Task tool
- **ALWAYS** use the most aligned/suitable subagent available for any discrete task or collection of related tasks.
- Keep the Archon tasks list up to date, and update task statuses - set tasks to "doing" before beginning implementation
- Move Archon tasks to review before completion
- Make sure that Archon tasks are synched with the PRP documents, and all Archon titles are prefixed with the correct Phase and Task IDs PXTX (e.g. P1T1: Initialise project)
- Use subagents or _subagent teams_, to assign tasks to the best/optimal, most-suitable, and most-qualified agent/s.
- Spawn agents in parallel using the Task tool, and when tasks have been marked as parallelizable [P]
- Share comprehensive and detailed information between agent/caller to guarantee robust results and context integrity and relevance.
- NEVER create duplicate tasks - ALWAYS check existing tasks first to ensure new tasks are unique and not duplicating task (or subtask) entries. Update existing tasks where suitable.
- For each Archon task, identify discrete tasks or collections of related tasks (and sequences of tasks) that are suitable for parallelization, and mark each task with `[P]` (this will be used to schedule and run multiple subagents simultaneously using the Task tool).
- Make sure the `assignee` of each task is set to the most-suitable/most-aligned agent to complete each task.
- Provide a lean but complete foundation for the task within the task description:
- A clear task goal and success criteria, with error handling and fallback guidance
- Extensive relevant details and context to complete the task
- Indicate any task dependencies or pre-requisite resources, configurations, or prior-work
- Suggest if suitable for parallelization (mark task title with `[P]`) , and any particular task sequence requirements
- Specify intended task sequence, scope, and code-base influence
- Include references to any required/useful project documents, or external sources
- Instruct agents to share markdown files if necessary, written to folder `wip/` - clearly named, also with agent name and datetime

### CORE INSTRUCTIONS

  ✅ Use the **Task tool** to spawn multiple subagents to work in _parallel_.
  ✅ **NO mock/dummy data** - Only real, validated data.
  ✅ **NO placeholder components, systems, code, or data to be used EVER!** - Real and actual data/implementations only.
  ✅ **NO backwards compatibility** - Clean, modern implementation.
  ✅ **Real database operations ALWAYS** - No bypassed or disabled features.
  ✅ **Production-ready code ONLY** - No temporary workarounds EVER!
  ✅ **NEVER ASSUME, PRESUME, OR GUESS** - When in doubt, ask for clarification.
  ✅ **ALWAYS require a full and complete implementation AND integration of every feature into the platform** - All subtasks, and task implementations/solutions/outputs MUST be fully complete, robust, and integrated and tested successfully, AND the feature/solution working correctly broadly within the platfom, BEFORE a task is to be considered completed or the task status is set to `review`.
  ✅ **NEVER assume task completeness** - or over-estimate progress or completion status until the developer has reviewed and tested the implementation.  
  ✅ **Always VERIFY file paths and module names** before use.
  ✅ **Keep CLAUDE.md updated** when adding new patterns or dependencies.
  ✅ **TEST your code** - No feature is complete without passing tests.
  ✅ **DOCUMENT your decisions** - for the dev team, and for future developers and contributors.
  ✅ **NEVER "WORK AROUND" anything!** - Real, correct, and targeted solutions only are permitted!
  ✅ **REMINDER: NEVER USE OR ADD PLACEHOLDER COMPONENTS/SYSTEMS/CODE/DATA**
