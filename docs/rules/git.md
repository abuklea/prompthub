# Git Workflow

## Branch Strategy
- **`master`** - Production-ready stable code
- **`dev`** - Main development branch (current working branch) 
- **`feature/feature-name`** - Individual feature development

## Development Commands

```bash
# Start new feature development
git checkout dev && git pull origin dev
git checkout -b feature/your-feature-name

# Development workflow
git add . && git commit -m "feat: {description}"
git push -u origin feature/your-feature-name

# Complete feature (merge to dev)
git checkout dev && git merge feature/your-feature-name
git push origin dev && git branch -d feature/your-feature-name

# NEVER include Claude Code sign-off or signature in commit messages.
# Use: [feat/remove/refactor/style/fix/chore/plan/docs/optimise] prefixes and other standards as appropriate
```

### Task completion and source tracking (git)
1. BEFORE task completion:
- Run any required tests test suites, and fix any errors
- Re-run the tests after each update/fix, and iterate to fix errors/issues
- Verify test coverage of primary files, systems, and functions, meets 80%+
- Make sure any fixes don't introduce new errors or unrelated issues, or break other tests for other fixes.
- Run additional checks specific to primary files (linting, type checking, etc.)

2. AFTER task completion, commit the completed task and any successful result/changes to git:
- Stage all required unstaged changes to git for this commit
- Develop a lean but detailed commit <message> that presents all changes in the commit as a list, e.g.:
```
fix: error from xyz fixed and feature online
  - This change
    - Issues encountered, etc
  - That change
    - Project effect, etc
```  
- **NEVER** add any author or sign-off into the commit message.
- Use commit subject prefixes, `<prefix>: <log>` from [feat/remove/refactor/style/fix/chore/plan/assets/samples/docs/optimise]. EXAMPLES: "chore: reversing a silly mistake", "style: updating theme consistency", "plan: a new feature for xyz", "remove: deleted supersceded implementation", etc ...)
- Generate a git commit <message> based on `git diff` and commit the staged changes:
```
Bash(git add .)
Bash(git diff --staged)
Bash(git commit -m "<message>")
```