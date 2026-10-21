# PromptHub
## P7S1 Decisions

| `Title` | `Created` | `Last modified` |
|---------|-----------|-----------------|
| P7S1 Decisions | 20/10/2026 15:36 GMT+10 | 22/10/2026 07:53 GMT+10 |

## Table of Contents
- [Purpose](#purpose)
- [D1 Version model](#d1-version-model)
- [D2 Drafts and the baseline](#d2-drafts-and-the-baseline)
- [D3 Autosave](#d3-autosave)
- [D4 Restore](#d4-restore)
- [D5 Test seams](#d5-test-seams)
- [D6 The loader protocol](#d6-the-loader-protocol)
- [D7 Async completions](#d7-async-completions)

## Purpose

The seven decisions behind [the PRP](../P7S1-editor-data-integrity.md). They are made in the plan so that the executing
agents do not guess. Four were put to the developer, who on 22/10/2026 confirmed D1, D2 and D5 as written and D4 with
one addition, a question before a restore. A later change redoes the tasks that build on a decision: D1 redoes T2 and
T3, D2 redoes T4 and T6, D4 redoes T8, and D5 redoes T1 and the seams of every later test. The interfaces and protocols
that implement them are in [the contract](P7S1-editor-persistence-contracts.md).

## D1 Version model

Confirmed 22/10/2026, as written: issue #33 delegates this choice to the PRP. A version is the saved state.
`saveVersion` updates the prompt row and records the new title and content as the snapshot in one transaction,
skipping the snapshot when it equals the newest version. `restoreVersion` locks the row, records the row as it stands
first when the newest version differs from it (so a restore never destroys autosaved work), writes the restored state,
and records it as a new version unless it equals the newest one, which matches the stories document, whose "Reverting
to a Version" item says to "save it as a new version, preserving the full history"
([Prompt Editor](../../docs/project/PromptHub_02_STORIES_01.md#prompt-editor)). History orders by `id desc`: ids are
assigned in write order under the row lock, while `created_at` is stamped by each app instance's own clock. No schema
change; existing rows stay restorable snapshots. A restore snapshots the saved row, not text only the browser holds,
which is why D4 saves unsaved edits first. Rejected: separate draft columns on `Prompt` (a migration, and every reader
of `Prompt.content` would disagree with the editor) and snapshot-of-previous, which is the defect. This model
implements Plan Step 3b ("auto-save updates current content, manual save creates versions",
[Phase 5](../../docs/project/PromptHub_06_PLAN_01.md#phase-5-prompt-editor--version-control)).

## D2 Drafts and the baseline

Confirmed 22/10/2026, as written: the conflict policy, the legacy rule and the new key. The client tracks `synced`,
the title and content last known to be on the server. The draft is content only,
`{"v":1,"base":"<hash>","content":"..."}` under the new key `prompt-v1-<id>`, so a tab or a rollback still running the
old code never reads JSON as document text. `useDraftSync` writes it while the working content differs from
`synced.content`, removes it when they are equal, and owns only the values it wrote. The loader removes the values it
read and did not apply, and only after their text is safe elsewhere (stashed, migrated to v1, or equal to the server's),
so a refused write leaves the stored value for the next load.

At load a draft is applied when its base matches the hash of the server content. A draft that does not match is a
conflict and its text is never deleted: the server copy wins, the text is stashed under `prompt-v1-<id>:conflict`, and a
20-second warning toast offers "Restore my text" once. The stash is a recovery copy, not a queue: nothing re-offers it
after the toast, and it stays in the storage until another conflict replaces it or the purge of #44 removes it.
Restoring it is the user's explicit choice and a last-writer-wins write: the next autosave replaces the server's text,
and an autosave records no version, so that text is not kept in history. The raw value of the removed hook under
`prompt-<id>` is read once: applied when the document was never saved (its title is blank), because it is then the only
copy, and treated as a conflict otherwise, because the old hook never cleared a draft and a saved document's is usually
older than the server. The base is a content hash, not `updated_at`, which `renamePrompt` bumps without changing content
and so would discard an untitled document's draft after a rename.

Accepted: typing after an autosave whose response was lost, or after a save that completed once the editor had
unmounted, raises a conflict on reload (the text is offered, not lost); two tabs still race on one key; a stash holds
one conflict per document. Rejected: carrying the hash of every unconfirmed save in the envelope to prevent a false
conflict after a lost response; it needs a channel from three save paths into the writer for a rare event that the
action already recovers from. The legacy read and the versioned key are a deliberate, bounded exception to
[the rule against keeping backwards compatibility](../../docs/rules/project.md#working-rules): a draft can be the only
copy of unsaved text. A follow-up issue filed with the REPORT removes the legacy read once old drafts can no longer
exist.

## D3 Autosave

`needsAutoSave(promptId, working, synced)` is false without a baseline for that document, without a non-blank title, or
when nothing differs. `useAutoSave` takes the baseline, depends on it, and reads `onSave` through a ref so a new
callback never re-arms the timer. `useServerAutoSave` passes it no `promptId` while a save or a restore is in flight,
which cancels a pending write. Server actions in one tab run one at a time in call order (verified in the pinned Next,
see the contract), so no ordering guard is needed.

## D4 Restore

Confirmed 22/10/2026, with one addition. The UI document says the restore should "prompt the user to save it as a new
version" ([Screen 3 - State 4: Diff View](../../docs/project/PromptHub_04_UI_01.md#screen-3---state-4-diff-view)), the
stories say save it, and issue #32 expects the editor to show the restored text and the draft to be cleared. This PRP
follows the stories: the restore is written to the server at once, because with autosave a restore that only filled the
editor would be saved 500 ms later, replacing the text it displaced before anything recorded it. The addition is the
developer's: Restore on a version asks "Restore this version?" first, in the project's AlertDialog pattern, with the
text "Your current text stays in the version history, so you can come back to it." Cancel and Escape close the question
only and restore nothing, and a question belongs to the opening and the document it was asked in.
`useVersionRestore` owns the call, so it can pause autosave and be tested without the dialog. `VersionHistoryDialog`
reads its list when it opens, takes `loadHistory` and `onRestore(versionId)`, asks before it restores, disables every
Restore button while a restore runs, ignores requests to close meanwhile, and closes itself only when the restore
succeeded. `restorePromptVersion` returns `{ title, content }`, and `applyServerState(promptId, row)` replaces title,
content, `promptData`, `synced` and `lastSaved` of the open document, or only the cache entry of a document the editor
has left. Before the request, `handleRestore` saves unsaved edits of a titled document through `autoSavePrompt` and
aborts if that fails, so the restore snapshots them; with a blank title and unsaved edits it refuses and says why,
because a blank title cannot be autosaved and the restore would replace the only copy.

## D5 Test seams

Confirmed 22/10/2026, as written: adds three devDependencies and departs from the wording of #37 and #45.
[The testing rules](../../docs/rules/testing.md#rules) forbid mocking a module of this repository, so the issues' "auth
stubbed at the `createClient` boundary" is not followed. Server logic moves to `src/features/editor/service.ts`, which
takes `(db, userId, input)`; the actions stay thin shells with the same validation, authentication and rate limits they
have today. The tests call the service against a real Postgres and never import an action, `@/lib/db` or Supabase code;
how every action is tested is #45's decision (one option is a fake Auth HTTP server behind `SUPABASE_URL`). The service
has no `"use server"` directive because every export of such a file is a public endpoint and these functions take a
`userId`.

Hook and component tests need a DOM: `jsdom@^26.1.0`, `@testing-library/react@^16.3.0` and
`@testing-library/dom@^10.4.0` as devDependencies, which #37 anticipates ("needs `*.test.tsx` in the Vitest `include`"),
and `esbuild: { jsx: "automatic" }` in `vitest.config.ts`, because `tsconfig.json` sets `"jsx": "preserve"`, so a JSX
test fails with `ReferenceError: React is not defined`; jsdom 26 supports Node 18 and later, while jsdom 30 requires
Node 22.22.2. Hooks and the dialog take their IO as parameters, and `EditorPane` supplies the real functions.

The database helper refuses a `TEST_DATABASE_URL` that is not on a loopback host, whose database name lacks "test", that
lists more than one host, or that carries a `host`, `hostaddr` or `port` query parameter, found among the decoded keys
because Prisma 6.19.0 also honours `?%68ost=` (the T1 brief records the probe). It treats an empty value as unset, and
it throws when the value is unset in GitHub Actions so a misconfigured workflow cannot skip the suites silently.

## D6 The loader protocol

Proved by a spike; the contract has the details. The load effect waits for the user id and shows loading meanwhile (a
lookup that fails or takes more than 10 seconds settles as `anonymous`; the id is looked up on every mount, because a
remembered id would outlive a change of session and show one user's cache to the next), and lets an aborted run touch
nothing. The anonymous identity has no cache entries, because every unresolved lookup would share them. The document and
`synced` arrive in one reducer action, so `ready` (`synced.promptId === promptId`) is true only in renders whose content
belongs to that document. It replaces `isTransitioning`, `contentPromptIdRef` and `titlePromptIdRef`, whose release
depended on an effect that a fresh-mount cache hit never re-ran. The editor mounts only when `ready`.

## D7 Async completions

Every request completes after the user may have moved on. A handler captures its `promptId` and `tabId` when it starts,
applies its result through `markSynced` or `applyServerState`, which take that id and return whether the document is
still open (false after the editor unmounted), resets its busy flag in a `finally`, and treats a rejected action as a
failed one. A save or a restore also requires that the loader holds the baseline of the handler's own document, so a
callback left over from another document sends nothing. Server actions and the document fetch run under a 30-second
limit (`withTimeout`), because in the pinned Next a navigation leaves the actions queued behind the pending one
unsettled (the task context cites the lines). The request itself is not cancelled and its late result is ignored.
