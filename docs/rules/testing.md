# Testing Rules

| `Title` | `Created` | `Last modified` |
|---------|-----------|-----------------|
| Testing Rules | 07/11/2025 12:46 GMT+10 | 29/10/2026 21:32 GMT+10 |

## Table of Contents
- [Test-Driven Development](#test-driven-development)
- [Test Layers](#test-layers)
- [Rules](#rules)
- [Commands and the Stop Hook](#commands-and-the-stop-hook)

## Test-Driven Development

1. Write the test first: define the expected behaviour before the implementation.
2. Watch it fail, for the right reason. A test that never failed proves nothing.
3. Write the minimum code that makes it pass.
4. Refactor with the suite green.
5. Repeat, one test at a time.

Pure logic (parsers, schemas, maths, state machines, decision functions) is always written test-first against
known-correct fixtures.

## Test Layers

| Layer | Covers |
|---|---|
| Unit | Pure logic, exhaustively: boundaries, error paths, every branch. Fast, deterministic, most of the value. |
| Integration | Where two seams meet and their contract is easy to get wrong, including code against a real disposable database, which skips when none is configured and refuses a non-local one. |
| Component | Hooks and components in a simulated DOM: state, events and rendered structure, never layout. |
| End-to-end | Only what nothing else can see: real rendering, layout, media, network, user gestures. Wait on an observable condition, never a sleep. |
| Manual | Real devices, hardware and deployed environments. The developer runs these; each one gets a `type: dev-review` issue. |

- The project's own layers, tools and fixtures are in `project.md`.
- Coverage: 80%+ on lines, functions, branches and statements, weighted to the pure-logic modules where bugs hide.
- Test every implementation of an interface, including fallbacks chosen at runtime.
- Headless environments (jsdom, null graphics devices) have no layout, GPU, media decoding or image loading. Never
  assert those in a unit test: cover them end-to-end or manually, and report which.

## Rules

- Use real data. Commit real (sanitised) samples as fixtures; never invent data where real data exists.
- Never mock a module of this repository. Inject seams (clock, fetch, filesystem, storage, browser APIs) with real
  defaults, and drive them from fakes.
- Assert behaviour and values, not call counts.
- Every new server action ships with an isolation test: user B calls the action with user A's ids and the test asserts
  the result equals what a missing id returns and that A's rows are unchanged. Name it `"<action>: user B ..."` (the
  action's exact name, a colon, then the case) in a `*.isolation.test.ts` file beside its handlers, inside
  `describeDb`. `src/test/action-coverage.test.ts` enforces it without a database: it fails and names any action
  (an `export async function` of a file whose first statement is `"use server"`) with no such title, any wrapper that
  does not call `handlers.<action>(actionDeps` over its handler, any other export from a `"use server"` file, and an
  `ensure-profile.ts` that is not server-only. Exceptions: `signIn` and `signUp` (titled `"signIn: ..."` and
  `"signUp: ..."` in `src/features/auth/handlers.test.ts`, with `authDeps`) and `signOut` (no tenant data, no handler).
- Never edit an existing test to make a change pass. If a test is wrong, stop and say which test and why: that
  decision is the developer's.
- Never raise a timeout to make a test pass. A timeout that passes on one re-run under load is load: report it.
- Write general solutions with standard tools: correct for all valid inputs, no hard-coded values, no special-casing
  test inputs, no helper scripts or workarounds that game the task. Tests verify the solution; they do not define it.
- If a task is infeasible or a test is incorrect, say so instead of working around it.

## Commands and the Stop Hook

```bash
{{TEST_CMD}}        # unit tests; must pass before any stop or commit
{{TYPECHECK_CMD}}   # zero errors
{{E2E_CMD}}         # end-to-end tests, when defined
```

The Stop hook (`.claude/hooks/stop_tests_must_pass.py`) runs `{{TEST_CMD}}` when a turn ends and blocks the turn
while it is red; it stands down until its `TEST_COMMAND` is set. With `GUARD_TEST_EDITS` on it also refuses a green
run produced by editing tests after a block, so write new tests before the first stop, never after.
