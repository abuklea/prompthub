#!/usr/bin/env python3
"""
Project: PromptHub
Author: Allan James
Source: wip/P7S1-mutation-check.py
MIME: text/x-python
Type: Python script (research tooling, not part of the application)

Created: 20/10/2026 14:15 GMT+10
Last modified: 20/10/2026 14:27 GMT+10
---------------
Mutation check for the P7S1 reference implementations. It applies one deliberate defect at a time to a spike
(wip/P7S1-draft-spike.ts, -loader-spike.ts, -persistence-spike.ts or -dialog-spike.tsx), runs the four spike suites and
reports whether any test failed (the defect was KILLED) or none did (it SURVIVED, so no test notices that defect). A
spike is restored after every run, also when the script is interrupted; if the process is killed outright,
`git checkout -- wip/` restores the files. Each mutation names the behaviour it breaks, so a survivor points at a missing
test. The patterns match the spike sources, so the check proves the reference tests; it does not run against the files
an executing agent adapts from them, and the main session runs it whenever a spike or its suite changes.

Usage:
  python3 wip/P7S1-mutation-check.py              # every mutation (about 5 minutes)
  python3 wip/P7S1-mutation-check.py P1 D3 H10    # only these ids
  python3 wip/P7S1-mutation-check.py --list       # ids and descriptions
Exit status: 0 when every mutation was killed, 1 when one survived, broke the file or did not match.

Changelog:
20/10/2026 14:27 GMT+10 | Docstring: the check proves the reference tests and does not run against adapted files
20/10/2026 14:15 GMT+10 | Created from the per-suite scratch scripts of the research session; adds the history dialog (H)
"""

import re
import shutil
import subprocess
import sys
import tempfile
from dataclasses import dataclass
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SPIKES = {
    "draft": "wip/P7S1-draft-spike.ts",
    "loader": "wip/P7S1-loader-spike.ts",
    "persistence": "wip/P7S1-persistence-spike.ts",
    "dialog": "wip/P7S1-dialog-spike.tsx",
}
SUITES = [
    "wip/P7S1-draft-spike.test.tsx",
    "wip/P7S1-loader-spike.test.tsx",
    "wip/P7S1-persistence-spike.test.tsx",
    "wip/P7S1-dialog-spike.test.tsx",
]
CONFIG = "wip/P7S1-vitest.diag.config.ts"


@dataclass(frozen=True)
class Mutation:
    """One defect: `old` must occur exactly once in the spike and is replaced by `new` (and `also`, in the same file)."""

    id: str
    spike: str
    description: str
    old: str
    new: str
    also: tuple = ()


MUTATIONS = [
    Mutation(
        'P1',
        'persistence',
        'useAutoSave ignores the baseline',
        old='if (!promptId || !needsAutoSave(promptId, { title, content }, baseline)) return',
        new='if (!promptId || !title?.trim()) return',
    ),
    Mutation(
        'P2',
        'draft',
        'needsAutoSave ignores which document the baseline is for',
        old='synced !== null && synced.promptId === promptId && Boolean(working.title?.trim())',
        new='synced !== null && Boolean(working.title?.trim())',
    ),
    Mutation(
        'P3',
        'persistence',
        'useAutoSave depends on the onSave identity',
        old=(
            'const timer = setTimeout(() => onSaveRef.current(promptId, title, content), delay)\n'
            '    return () => clearTimeout(timer)\n'
            '  }, [promptId, title, content, baseline, delay, onSaveRef])'
        ),
        new=(
            'const timer = setTimeout(() => onSave(promptId, title, content), delay)\n'
            '    return () => clearTimeout(timer)\n'
            '  }, [promptId, title, content, baseline, delay, onSave])'
        ),
    ),
    Mutation(
        'P4',
        'persistence',
        'autosave is not paused while busy',
        old='promptId: loader.ready && !busy ? promptId : null,',
        new='promptId: loader.ready ? promptId : null,',
    ),
    Mutation(
        'P5',
        'persistence',
        'autosave never resets its flag',
        old='      } finally {\n        inFlight.current -= 1\n        setAutoSaving(inFlight.current > 0)\n      }',
        new='      } finally {\n      }',
    ),
    Mutation(
        'P6',
        'persistence',
        'manual save never resets its flag',
        old='      } finally {\n        savingRef.current = false\n        setSaving(false)\n      }',
        new='      } finally {\n      }',
    ),
    Mutation(
        'P8',
        'persistence',
        'the confirmed title is not made the working title',
        old='      loaderRef.current.setTitle(newTitle)\n      setShowSetTitleDialog(false)',
        new='      setShowSetTitleDialog(false)',
    ),
    Mutation(
        'P9',
        'persistence',
        'a second save while one is in flight is accepted',
        old='if (!current.ready || savingRef.current || blockedRef.current) return',
        new='if (!current.ready || blockedRef.current) return',
    ),
    Mutation(
        'P10',
        'persistence',
        'a save does not wait for the document',
        old='if (!current.ready || savingRef.current || blockedRef.current) return',
        new='if (savingRef.current || blockedRef.current) return',
    ),
    Mutation(
        'P11',
        'persistence',
        'a save is accepted during a restore',
        old='if (!current.ready || savingRef.current || blockedRef.current) return',
        new='if (!current.ready || savingRef.current) return',
    ),
    Mutation(
        'P12',
        'persistence',
        'a restore does not save unsaved edits first',
        old='        if (!(await flushUnsaved(promptId, current, actions))) return false\n',
        new='',
    ),
    Mutation(
        'P13',
        'persistence',
        'a restore continues after a failed flush',
        old='        if (!(await flushUnsaved(promptId, current, actions))) return false\n',
        new='        await flushUnsaved(promptId, current, actions)\n',
    ),
    Mutation(
        'P14',
        'persistence',
        'a restore never resets its flag',
        old='      } finally {\n        restoringRef.current = false\n        setRestoring(false)\n      }',
        new='      } finally {\n      }',
    ),
    Mutation(
        'P16',
        'persistence',
        'the cache is written for a document that is not ready',
        old='if (!ready || !promptData || !synced) return',
        new='if (!promptData || !synced) return',
    ),
    Mutation(
        'P17',
        'persistence',
        'a preview tab is not promoted by an edit',
        old='    if (isDirty && tab?.isPreview) promotePreviewTab(tabId)\n',
        new='',
    ),
    Mutation(
        'P20',
        'persistence',
        'a saved version does not patch promptData',
        old='current.markSynced({ promptId, title: valid.data, content: sent }, { version: true })',
        new='current.markSynced({ promptId, title: valid.data, content: sent })',
    ),
    Mutation(
        'P21',
        'persistence',
        'saves are not blocked by a restore',
        old='blocked: restore.restoring })',
        new='blocked: false })',
    ),
    Mutation(
        'P22',
        'persistence',
        'autosave ignores the busy state in the composition',
        old='busy: version.saving || restore.restoring })',
        new='busy: false })',
    ),
    Mutation(
        'P24',
        'persistence',
        'an autosave does not advance the baseline',
        old='        markSynced({ promptId: id, title, content })\n        updatePromptTitle(id, title ?? "")',
        new='        updatePromptTitle(id, title ?? "")',
    ),
    Mutation(
        'P25',
        'loader',
        'a restore result is applied to whichever document is open',
        old='      if (id !== promptIdRef.current) return false\n      dispatch({ type: "serverState"',
        new='      dispatch({ type: "serverState"',
    ),
    Mutation(
        'P26',
        'loader',
        'a save result is applied to whichever document is open',
        old='      if (next.promptId !== promptIdRef.current) return false\n      dispatch({ type: "synced"',
        new='      dispatch({ type: "synced"',
    ),
    Mutation(
        'P27',
        'loader',
        'a rejected fetch leaves the loader loading',
        old=(
            '  try {\n    return await ctx.io.fetchPrompt(ctx.promptId)\n  } catch {\n'
            '    return { success: false, error: LOAD_FAILED }\n  }'
        ),
        new='  return await ctx.io.fetchPrompt(ctx.promptId)',
    ),
    Mutation(
        'P28',
        'loader',
        'the conflict action ignores which document is open',
        old='if (ctx.monacoPromptIdRef.current === ctx.promptId) ctx.dispatch',
        new='ctx.dispatch',
    ),
    Mutation(
        'P29',
        'draft',
        'a conflict is not kept',
        old='    storage.setItem(conflictKey(promptId), content)',
        new='    void content',
    ),
    Mutation(
        'P30',
        'persistence',
        'a restore does not wait for the document',
        old='if (!current.ready || restoringRef.current) return false',
        new='if (restoringRef.current) return false',
    ),
    Mutation(
        'P31',
        'persistence',
        'a save forces the dirty flag of a document that is not open',
        old='updateTab(tabId, stillOpen ? { isDirty: false, isNewDocument: false } : { isNewDocument: false })',
        new='updateTab(tabId, { isDirty: false, isNewDocument: false })',
    ),
    Mutation(
        'D1',
        'draft',
        'useDraftSync ignores ready',
        old='if (!ready || syncedContent === null || base === null) return',
        new='if (syncedContent === null || base === null) return',
    ),
    Mutation(
        'D2',
        'draft',
        'removeIfUnchanged ignores the raw value',
        old='if (storage.getItem(key) === raw) storage.removeItem(key)',
        new='storage.removeItem(key)',
    ),
    Mutation(
        'D3',
        'draft',
        'a v1 draft with another base is applied',
        old=(
            'return draft.base === hashContent(server.content) ? { kind: "apply", content: draft.'
            'content } : { kind: "conflict" }'
        ),
        new='return { kind: "apply", content: draft.content }',
    ),
    Mutation(
        'D4',
        'draft',
        'a refused write drops ownership',
        old='if (written !== null) owned.set(promptId, written)',
        new='if (written !== null) owned.set(promptId, written)\n    else owned.delete(promptId)',
    ),
    Mutation(
        'D5',
        'draft',
        'the writer adopts the stored value as owned',
        old='    const owned = ownedRef.current\n',
        new=(
            '    const owned = ownedRef.current\n'
            '    if (!owned.has(promptId)) { const r = readRaw(storage, draftKey(promptId)); if ('
            'r !== null) owned.set(promptId, r) }\n'
        ),
    ),
    Mutation(
        'D6',
        'draft',
        'the writer never clears',
        old=(
            '      if (raw !== undefined) {\n        clearDraft(storage, promptId, raw)\n'
            '        owned.delete(promptId)\n      }\n      return'
        ),
        new='      return',
    ),
    Mutation(
        'D7',
        'draft',
        'the base is the working content',
        old='const written = writeDraft(storage, promptId, { content, base })',
        new='const written = writeDraft(storage, promptId, { content, base: hashContent(content) })',
    ),
    Mutation(
        'D8',
        'loader',
        'the loader baseline includes the draft',
        old='synced: { promptId: ctx.promptId, ...server },',
        new='synced: { promptId: ctx.promptId, title: server.title, content: restoreDraft(ctx, server) },',
    ),
    Mutation(
        'D9',
        'loader',
        'the loader does not discard a consumed draft',
        old='  if (read && (decision.kind !== "apply" || read.legacy)) discardRead(storage, ctx.promptId, read)\n',
        new='',
    ),
    Mutation(
        'D10',
        'draft',
        'a legacy draft is applied to a saved document',
        old=(
            'return (server.title ?? "").trim() === "" ? { kind: "apply", content: draft.content '
            '} : { kind: "conflict" }'
        ),
        new='return { kind: "apply", content: draft.content }',
    ),
    Mutation(
        'D11',
        'draft',
        'empty drafts are not applied',
        old='if (draft === null || draft.content === server.content) return { kind: "none" }',
        new='if (draft === null || draft.content === server.content || draft.content === "") return { kind: "none" }',
    ),
    Mutation(
        'D12',
        'draft',
        'ownership is forgotten when the document changes',
        old='    const owned = ownedRef.current\n',
        new=(
            '    const owned = ownedRef.current\n'
            '    if (owned.get("__last") !== promptId) { owned.clear(); owned.set("__last", promp'
            'tId) }\n'
        ),
    ),
    Mutation(
        'D14',
        'draft',
        'anything that is not a v1 envelope is read as text',
        old='return parsed.success ? { content: parsed.data.content, base: parsed.data.base } : null',
        new=(
            'return parsed.success ? { content: parsed.data.content, base: parsed.data.base } : {'
            ' content: raw, base: null }'
        ),
    ),
    Mutation(
        'D15',
        'draft',
        'the legacy value is preferred over the v1 envelope',
        old='  if (v1 && v1Raw !== null) return { draft: v1, raw: v1Raw, legacy: false }\n',
        new='',
    ),
    Mutation(
        'D16',
        'draft',
        'an empty legacy value is a draft',
        old='if (legacyRaw) return',
        new='if (legacyRaw !== null) return',
    ),
    Mutation(
        'L3',
        'loader',
        'ready does not compare the document',
        old='ready: state.synced !== null && state.synced.promptId === promptId,',
        new='ready: state.synced !== null,',
    ),
    Mutation(
        'L4',
        'loader',
        'loading starts false',
        old='loading: Boolean(id) })',
        new='loading: false })',
    ),
    Mutation(
        'L5',
        'loader',
        'no identity timeout',
        old='    timer = setTimeout(() => settle(ANONYMOUS), IDENTITY_TIMEOUT_MS)\n',
        new='',
    ),
    Mutation(
        'L6',
        'loader',
        'a late identity answer is accepted',
        old='    const settle = (id: string) => {\n      if (settled) return\n      settled = true\n',
        new='    const settle = (id: string) => {\n',
    ),
    Mutation(
        'L8',
        'loader',
        'an aborted load still applies',
        old='  if (ctx.signal.aborted) return\n',
        new='',
    ),
    Mutation(
        'L9',
        'loader',
        'a new document is not wiped before it loads',
        old='  monacoPromptIdRef.current = null\n  dispatch({ type: "wipe" })',
        new='  monacoPromptIdRef.current = null',
    ),
    Mutation(
        'L11',
        'loader',
        "the cache returns another user's entry",
        old=(
            '  if (entry.userId !== userId) {\n'
            '    documentCache.delete(cacheKey(userId, promptId))\n    return null\n  }\n'
        ),
        new='',
    ),
    Mutation(
        'Q1',
        'persistence',
        'autoSaving is a boolean, not a count',
        old='        setAutoSaving(inFlight.current > 0)',
        new='        setAutoSaving(false)',
    ),
    Mutation(
        'Q2',
        'persistence',
        'a second restore is accepted while one runs',
        old='if (!current.ready || restoringRef.current) return false',
        new='if (!current.ready) return false',
    ),
    Mutation(
        'Q3',
        'persistence',
        'an autosave does not update the list title',
        old='        markSynced({ promptId: id, title, content })\n        updatePromptTitle(id, title ?? "")',
        new='        markSynced({ promptId: id, title, content })',
    ),
    Mutation(
        'Q4',
        'loader',
        'the monaco ref is not cleared before a load',
        old='  monacoPromptIdRef.current = null\n  dispatch({ type: "wipe" })',
        new='  dispatch({ type: "wipe" })',
    ),
    Mutation(
        'Q5',
        'persistence',
        'a restore for a document that is not open leaves its dirty flag',
        old='updateTab(tabId, { title: getDisplayTitle(result.data.title), isDirty: false })',
        new='updateTab(tabId, { title: getDisplayTitle(result.data.title) })',
    ),
    Mutation(
        'Q6',
        'persistence',
        'the Meta key does not save',
        old='if ((e.ctrlKey || e.metaKey) && e.key === "s") {',
        new='if (e.ctrlKey && e.key === "s") {',
    ),
    Mutation(
        'Q7',
        'persistence',
        'a blank title with unsaved edits is restored over',
        old='  if (!title?.trim()) {\n    toast.error(NEEDS_TITLE_TOAST)\n    return false\n  }\n',
        new='',
    ),
    Mutation(
        'Q8',
        'persistence',
        'the save action is not limited by the timeout',
        old='    saveNewVersion: (input) => withTimeout(actions.saveNewVersion(input), ms),',
        new='    saveNewVersion: (input) => actions.saveNewVersion(input),',
    ),
    Mutation(
        'Q9',
        'persistence',
        'the autosave action is not limited by the timeout',
        old='    autoSavePrompt: (input) => withTimeout(actions.autoSavePrompt(input), ms),',
        new='    autoSavePrompt: (input) => actions.autoSavePrompt(input),',
    ),
    Mutation(
        'Q10',
        'persistence',
        'the restore action is not limited by the timeout',
        old='    restorePromptVersion: (input) => withTimeout(actions.restorePromptVersion(input), ms),',
        new='    restorePromptVersion: (input) => actions.restorePromptVersion(input),',
    ),
    Mutation(
        'Q11',
        'loader',
        'the conflict toast is not dismissed on cleanup',
        old='      toastIds.forEach((id) => toast.dismiss(id))\n',
        new='',
    ),
    Mutation(
        'Q12',
        'draft',
        'the timeout never fires',
        old='const timer = setTimeout(() => reject(new Error(REQUEST_TIMED_OUT)), ms)',
        new='const timer = setTimeout(() => {}, ms)',
    ),
    Mutation(
        'Q13',
        'draft',
        'the timer is not cleared on success',
        old='      (value) => {\n        clearTimeout(timer)\n        resolve(value)',
        new='      (value) => {\n        resolve(value)',
    ),
    Mutation(
        'Q14',
        'persistence',
        'the history read is not limited by the timeout',
        old='    getPromptVersionHistory: (input) => withTimeout(actions.getPromptVersionHistory(input), ms),',
        new='    getPromptVersionHistory: (input) => actions.getPromptVersionHistory(input),',
    ),
    Mutation(
        'H1',
        'dialog',
        'the list is not read when the parent opens the dialog (the defect of the current component)',
        old='    if (!open || !promptId) {\n      setLoad({ status: "idle" })\n      return\n    }',
        new='    if (true) {\n      setLoad({ status: "idle" })\n      return\n    }',
    ),
    Mutation(
        'H2',
        'dialog',
        'a late successful read replaces the list',
        old='      (result) => {\n        if (stale) return\n',
        new='      (result) => {\n',
    ),
    Mutation(
        'H3',
        'dialog',
        'a late failed read is reported',
        old='      () => {\n        if (stale) return\n',
        new='      () => {\n',
    ),
    Mutation(
        'H4',
        'dialog',
        'the list is not read again for another document',
        old='  }, [open, promptId, loadHistoryRef])',
        new='  }, [open, loadHistoryRef])',
    ),
    Mutation(
        'H5',
        'dialog',
        'loadHistory is read from props, so a new function re-reads the list',
        old='    loadHistoryRef.current(promptId).then(',
        new='    loadHistory(promptId).then(',
        also=(('  }, [open, promptId, loadHistoryRef])', '  }, [open, promptId, loadHistory])'),),
    ),
    Mutation(
        'H6',
        'dialog',
        'a failed result is not reported',
        old='          toast.error(result.error)\n          setLoad({ status: "failed" })',
        new='          setLoad({ status: "failed" })',
    ),
    Mutation(
        'H7',
        'dialog',
        'a rejected read is not reported',
        old='        toast.error(HISTORY_FAILED)\n',
        new='',
    ),
    Mutation(
        'H8',
        'dialog',
        'a failed read shows no message',
        old='{load.status === "failed" && <p className="text-sm text-muted-foreground">{HISTORY_FAILED}.</p>}',
        new='',
    ),
    Mutation(
        'H9',
        'dialog',
        'the list of a document that went away stays on screen',
        old='    if (!open || !promptId) {\n      setLoad({ status: "idle" })\n      return\n    }',
        new='    if (!open || !promptId) {\n      return\n    }',
    ),
    Mutation(
        'H10',
        'dialog',
        'only the clicked row is disabled while a restore runs',
        old='onClick={() => onRestore(item.id)} disabled={busy}',
        new='onClick={() => onRestore(item.id)} disabled={restoring}',
    ),
    Mutation(
        'H11',
        'dialog',
        'the dialog can be closed during a restore',
        old='    if (!next && busy) return\n',
        new='',
    ),
    Mutation(
        'H12',
        'dialog',
        'the dialog closes whatever the restore result',
        old='        if (await onRestore(versionId)) onOpenChange(false)',
        new='        await onRestore(versionId)\n        onOpenChange(false)',
    ),
    Mutation(
        'H13',
        'dialog',
        'the restoring state is never reset',
        old='      } finally {\n        setRestoringId(null)\n      }',
        new='      } finally {\n      }',
    ),
    Mutation(
        'H14',
        'dialog',
        'the clicked row does not say Restoring',
        old='{restoring ? "Restoring..." : "Restore"}',
        new='Restore',
    ),
    Mutation(
        'H15',
        'dialog',
        'an untitled snapshot shows no title',
        old='{item.title_snapshot || "[Untitled Doc]"}',
        new='{item.title_snapshot}',
    ),
]


def run_suites() -> str:
    proc = subprocess.run(
        ["npx", "vitest", "run", "--config", CONFIG, *SUITES],
        cwd=ROOT,
        capture_output=True,
        text=True,
        timeout=170,
    )
    return proc.stdout + proc.stderr


def failing_tests(output: str) -> tuple[list[str], list[str]]:
    """Names of the failing test cases, and of the files that failed to run at all (a broken mutation)."""
    cases, files = [], []
    for line in output.splitlines():
        m = re.match(r"\s*(?:FAIL|×)\s+(.*)", line)
        if not m:
            continue
        name = m.group(1).strip()
        bucket = files if name.startswith("wip/") and " > " not in name else cases
        if name not in bucket:
            bucket.append(name)
    return cases, files


def apply(original: str, mutation: Mutation) -> str | None:
    """The mutated text, or None when an `old` string does not occur exactly once."""
    text = original
    for old, new in ((mutation.old, mutation.new), *mutation.also):
        if text.count(old) != 1:
            return None
        text = text.replace(old, new, 1)
    return text


def main(argv: list[str]) -> int:
    ids = {m.id for m in MUTATIONS}
    if "--list" in argv:
        for m in MUTATIONS:
            print(f"{m.id:<4} {m.spike:<12} {m.description}")
        return 0
    wanted = set(argv)
    if wanted - ids:
        print("unknown ids:", ", ".join(sorted(wanted - ids)))
        return 2

    survived, broken, missing, killed = [], [], [], 0
    with tempfile.TemporaryDirectory(prefix="p7s1-mutation-") as tmp:
        backups = {key: Path(tmp) / Path(rel).name for key, rel in SPIKES.items()}
        for key, rel in SPIKES.items():
            shutil.copy(ROOT / rel, backups[key])
        try:
            for m in MUTATIONS:
                if wanted and m.id not in wanted:
                    continue
                target = ROOT / SPIKES[m.spike]
                mutated = apply(backups[m.spike].read_text(), m)
                if mutated is None:
                    print(f"{m.id}: PATTERN NOT FOUND ({m.description})")
                    missing.append(m.id)
                    continue
                target.write_text(mutated)
                try:
                    output = run_suites()
                finally:
                    shutil.copy(backups[m.spike], target)
                cases, files = failing_tests(output)
                summary = re.search(r"Tests\s+(.*)", output)
                state = "KILLED" if cases else ("BROKEN" if files else "SURVIVED")
                print(f"{m.id}: {state}  {m.description}  [{summary.group(1).strip() if summary else '?'}]")
                for name in cases[:3]:
                    print(f"    - {name[:150]}")
                if state == "KILLED":
                    killed += 1
                elif state == "BROKEN":
                    broken.append(m.id)
                else:
                    survived.append(m.id)
        finally:
            for key, rel in SPIKES.items():
                shutil.copy(backups[key], ROOT / rel)

    total = killed + len(survived) + len(broken) + len(missing)
    print(f"\n{total} mutations: {killed} killed, {len(survived)} survived, {len(broken)} broke the file, {len(missing)} not found")
    for label, found in (("survived", survived), ("broke the file", broken), ("not found", missing)):
        if found:
            print(f"{label}: {', '.join(found)}")
    return 0 if killed == total else 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
