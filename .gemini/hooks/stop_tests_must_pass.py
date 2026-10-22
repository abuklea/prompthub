#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.8"
# ///
"""
Stop hook - the feedback loop you cannot forget to run.

Fires when the agent tries to finish its turn. It runs your test command. If the
tests fail, it BLOCKS the stop and hands the failure output back to the agent,
which goes straight back to work. The agent literally cannot say "done" on red.

This is the single highest-value hook most projects can add. A rule that says
"always run the tests before you finish" is guidance, and the agent skips it the
moment the context gets long. This is the same instruction as a guarantee.

    exit 0 -> let it finish     exit 2 -> block the stop, stderr goes to the agent

Fails OPEN on anything unexpected, so a broken hook never traps you in a loop.

Changelog:
08/09/2026 12:05 GMT+10 | GUARD_TEST_EDITS now attributes a changed test file to
  the session that changed it, read from the PostToolUse action log, instead of
  blaming whichever session happens to be stopping. Two Gemini sessions sharing
  one working tree previously deadlocked the first one: it was blamed for the
  second's test edits, could not restore them without destroying uncommitted
  work, and could not clear the snapshot without disabling its own guard.
03/10/2026 19:04 GMT+10 | Packaged for the prp-project skill: TEST_COMMAND starts
  empty (the hook stands down until it is set) and the hard-coded package.json
  stand-down became RUN_ONLY_IF_EXISTS, so the hook fits any stack.

============================================================================
EDIT THESE (`/prp-project init` and `/prp-project update` set them from the
{{TEST_CMD}} value in docs/rules/project.md)
============================================================================
"""

# The project's unit-test command, run verbatim. Empty = the hook stands down,
# which is the state of a project whose test runner is not chosen yet.
TEST_COMMAND = 'npm test'

# Stand down until the project is scaffolded: run only when at least one of
# these files exists in the run directory, e.g. ("package.json",) or
# ("pyproject.toml",). Empty = always run once TEST_COMMAND is set.
RUN_ONLY_IF_EXISTS = ('package.json',)

# If your tests must run from a subdirectory (monorepo, or config that lives
# deeper like app/backend/), set it here. Relative to the project root.
TEST_SUBDIR = ""

# Seconds before we give up and let the agent finish anyway. A hook that hangs
# is worse than a hook that misses.
TIMEOUT_SECONDS = 300

# How much of the failure output to hand back. Enough to act on, not enough to
# blow out the context window.
MAX_OUTPUT_CHARS = 3000

# Close the loophole. With this on, the hook snapshots your test files the
# first time it blocks, and refuses a later green run if the suite only went
# green because those files changed.
#
# This exists because of an observed escape. The block message used to end with
# "unless the test itself is provably wrong", and handed a test asserting
# 2 + 2 == 5 the agent reasoned, out loud: "this qualifies as a provably wrong
# test, so I'll fix it", rewrote the test, and finished. The guarantee was not
# broken, it was argued past, through a door the guarantee itself held open.
#
# Set False if your agent legitimately writes tests as part of the same turn.
GUARD_TEST_EDITS = True

# Which files count as tests for the guard above. Project-relative globs.
TEST_GLOBS = (
    "tests/*", "tests/**/*", "test/*", "test/**/*",
    "**/test_*.py", "**/*_test.py", "**/*.test.*", "**/*.spec.*",
)

# Attribute a changed test file to the session that actually changed it.
#
# The guard above compares file hashes, and a hash cannot say WHO wrote it. When
# two Gemini sessions share one working tree - routine on this machine, three
# were live at once on 08/09/2026 - a second session's perfectly legitimate test
# edit is blamed on the first, which then cannot finish its turn at all, cannot
# fix it without destroying the other session's uncommitted work, and cannot
# clear it without deleting the guard's own state. Observed, not theoretical.
#
# The PostToolUse hook already records every tool call with its session id, so
# the answer is on disk. Read it, and blame only the files THIS session touched.
# When the log cannot be read the guard falls back to blaming every changed test
# file, exactly as before: attribution only ever narrows blame, and only when
# there is evidence to narrow it with.
ACTION_LOG = "logs/agent-actions.jsonl"
ACTION_LOG_TAIL_BYTES = 8 * 1024 * 1024
FILE_TOOLS = ("Edit", "MultiEdit", "Write", "NotebookEdit")
SHELL_TOOLS = ("Bash", "PowerShell")

# ============================================================================

import hashlib
import json
import os
import re
import subprocess
import sys
import tempfile
from pathlib import Path


def _test_files(root: Path) -> dict:
    """sha1 of every file matching TEST_GLOBS, keyed by project-relative path."""
    seen = {}
    for pattern in TEST_GLOBS:
        for path in root.glob(pattern):
            if not path.is_file():
                continue
            try:
                rel = path.resolve().relative_to(root.resolve()).as_posix()
                seen[rel] = hashlib.sha1(path.read_bytes()).hexdigest()
            except Exception:  # noqa: BLE001
                continue
    return seen


def _snapshot_path(session_id: str) -> Path:
    digest = hashlib.sha1(("stopguard" + session_id).encode("utf-8")).hexdigest()[:16]
    directory = Path(tempfile.gettempdir()) / "gemini-hook-stopguard"
    directory.mkdir(parents=True, exist_ok=True)
    return directory / f"{digest}.json"


def _remember_tests(root: Path, session_id: str) -> None:
    """Record test-file hashes the first time we block. Only the first time -
    re-recording after every block would let the agent edit tests one turn at a
    time and never trip the comparison."""
    path = _snapshot_path(session_id)
    if path.exists():
        return
    try:
        path.write_text(json.dumps(_test_files(root)), encoding="utf-8")
    except Exception:  # noqa: BLE001
        pass


def _forget_tests(session_id: str) -> None:
    """Drop the snapshot. Called once the suite goes green honestly."""
    try:
        _snapshot_path(session_id).unlink(missing_ok=True)
    except Exception:  # noqa: BLE001
        pass


def _shell_writes_to(command: str, rel: str, name: str) -> bool:
    """True if a shell command plausibly WRITES to this path.

    Deliberately narrow: the path has to sit next to a write operator. An agent
    investigating a failure runs `stat path`, `grep -n x path` and
    `git status path` constantly, and none of those may be read as an edit -
    that is the same false positive this whole block exists to remove, just
    reintroduced one layer down. Verified against this session's own history.

    A shell edit spelled some way this does not match goes unattributed and the
    guard misses it. That is a real hole, and it is the same hole the guard had
    before attribution existed, because a hash comparison never caught the
    author either. It is narrower than the parallel-session bug it replaces.
    """
    for target in (re.escape(rel), re.escape(name)):
        patterns = (
            rf">>?\s*['\"]?{target}",
            rf"\btee\b(\s+-a)?\s+['\"]?{target}",
            rf"\bsed\b[^|;&]*\s-i[^|;&]*{target}",
            rf"\b(cp|mv|install)\b[^|;&]*{target}",
            rf"\bgit\s+(checkout|restore|stash)\b[^|;&]*{target}",
            rf"\b(patch|truncate|shred)\b[^|;&]*{target}",
        )
        if any(re.search(p, command) for p in patterns):
            return True
    return False


def _session_actions(root: Path, session_id: str):
    """What THIS session did, per the PostToolUse log: (edited paths, commands).

    Returns None when the log cannot be read at all, which the caller treats as
    "cannot attribute" and falls back to the original blame-everything guard.

    Only the tail of the log is read, so a very long-lived session's earliest
    edits can fall outside the window and go unattributed. Edits that matter
    here happened between the first block and this stop, which is always the
    tail, so the window is generous rather than tight.
    """
    log = root / ACTION_LOG
    try:
        if not log.is_file():
            return None
        size = log.stat().st_size
        with log.open("rb") as handle:
            if size > ACTION_LOG_TAIL_BYTES:
                handle.seek(size - ACTION_LOG_TAIL_BYTES)
                handle.readline()  # drop the partial line the seek landed in
            raw = handle.read().decode("utf-8", errors="replace")
    except Exception:  # noqa: BLE001
        return None

    edited, commands = set(), []
    root_resolved = root.resolve()
    for line in raw.splitlines():
        try:
            entry = json.loads(line)
        except Exception:  # noqa: BLE001
            continue
        if str(entry.get("session", "")) != session_id:
            continue
        tool = str(entry.get("tool_name", ""))
        summary = str(entry.get("summary", ""))
        if not summary:
            continue
        if tool in FILE_TOOLS:
            try:
                candidate = Path(summary)
                if not candidate.is_absolute():
                    candidate = Path(entry.get("cwd") or root) / candidate
                edited.add(candidate.resolve().relative_to(root_resolved).as_posix())
            except Exception:  # noqa: BLE001
                edited.add(summary.replace("\\", "/"))
        elif tool in SHELL_TOOLS:
            commands.append(summary)
    return edited, commands


def _tampered_tests(root: Path, session_id: str) -> list:
    """Test files THIS session changed since we blocked. Empty list unless we
    actually blocked earlier in this session, so a normal green turn never pays
    for this."""
    path = _snapshot_path(session_id)
    if not path.exists():
        return []
    try:
        before = json.loads(path.read_text(encoding="utf-8"))
    except Exception:  # noqa: BLE001
        return []
    now = _test_files(root)
    # Only files present at snapshot time. A brand-new test file is the agent
    # adding coverage, which is good and must not be punished.
    changed = sorted(rel for rel, digest in before.items()
                     if rel in now and now[rel] != digest)
    if not changed:
        return changed

    actions = _session_actions(root, session_id)
    if actions is None:
        return changed  # no evidence to attribute with: guard as before
    edited, commands = actions

    mine = []
    for rel in changed:
        name = Path(rel).name
        if rel in edited or any(seen.endswith(rel) for seen in edited):
            mine.append(rel)
        elif any(_shell_writes_to(command, rel, name) for command in commands):
            mine.append(rel)
    return mine


def _project_env(project_root: Path) -> dict:
    """os.environ with uv's ephemeral venv removed and the PROJECT's venv put first.

    THIS IS THE PART EVERYONE GETS WRONG, and it fails in a way that looks like
    it works. This hook runs under `uv run` in an isolated throwaway environment.
    That interpreter is NOT your project's interpreter and has none of your
    project's dependencies.

    Two things have to happen, and most write-ups only mention the first:

      1. Drop uv's throwaway venv. If you rebuild the command with
         sys.executable, or leave uv's venv first on PATH, `python -m pytest`
         runs in an environment with no pytest at all.

      2. Put the project's OWN venv first. Removing uv's venv does not activate
         yours - a hook is not your shell, so `.venv` was never on PATH. Without
         this step `python` falls through to whatever global interpreter the
         machine has, which is a different, usually broken, set of packages.

    Skip step 2 and the hook exits 2 on a perfectly green suite, with an error
    about some unrelated module. Verified: that is exactly what happens.
    """
    env = os.environ.copy()

    # 1. uv's ephemeral venv, out.
    ephemeral = env.pop("VIRTUAL_ENV", None)
    path_parts = env.get("PATH", "").split(os.pathsep)
    if ephemeral:
        drop = {os.path.join(ephemeral, "Scripts"), os.path.join(ephemeral, "bin")}
        path_parts = [p for p in path_parts if p not in drop]

    # 2. The project's own venv, first - if it has one.
    for candidate in (".venv", "venv", ".env"):
        for bindir in ("Scripts", "bin"):
            venv_bin = project_root / candidate / bindir
            if venv_bin.is_dir():
                env["VIRTUAL_ENV"] = str(project_root / candidate)
                path_parts.insert(0, str(venv_bin))
                env["PATH"] = os.pathsep.join(path_parts)
                return env

    env["PATH"] = os.pathsep.join(path_parts)
    return env


def _clip(text: str) -> str:
    text = text.strip()
    if len(text) <= MAX_OUTPUT_CHARS:
        return text
    # Keep the tail. Test runners put the summary at the bottom.
    return "... [output truncated] ...\n" + text[-MAX_OUTPUT_CHARS:]


def main() -> None:
    try:
        data = json.load(sys.stdin)

        # Loop guard. Without this the hook blocks the stop, the agent works,
        # tries to stop again, is blocked again, forever. If Gemini Code tells us
        # we are already inside a stop-hook cycle, stand down.
        if data.get("stop_hook_active"):
            sys.exit(0)

        project_root = Path(data.get("cwd") or ".")
        run_dir = project_root / TEST_SUBDIR if TEST_SUBDIR else project_root

        # No test command chosen yet, or the project is not scaffolded yet:
        # nothing to test, stand down.
        if not TEST_COMMAND.strip():
            sys.exit(0)
        if RUN_ONLY_IF_EXISTS and not any((run_dir / name).exists() for name in RUN_ONLY_IF_EXISTS):
            sys.exit(0)

        result = subprocess.run(
            TEST_COMMAND,
            shell=True,               # run the command VERBATIM, as you typed it
            capture_output=True,
            text=True,
            cwd=str(run_dir),
            env=_project_env(run_dir),
            timeout=TIMEOUT_SECONDS,
        )

        session_id = str(data.get("session_id", ""))

        if result.returncode == 0:
            # Green. But green because the code got fixed, or green because the
            # test got rewritten? Only ask if we blocked earlier in this session.
            tampered = _tampered_tests(project_root, session_id) if GUARD_TEST_EDITS else []
            if not tampered:
                # Cleared honestly. Drop the snapshot so the guard covers only
                # the red-to-green window it was created for. Leave it in place
                # and any legitimate test edit later in the same session gets
                # blocked by a snapshot taken for an argument already settled.
                _forget_tests(session_id)
            if tampered:
                print(
                    "BLOCKED: the suite is green, but it is green because the "
                    "tests changed.\n\n"
                    "Modified BY THIS SESSION since this hook first blocked "
                    "(files another Gemini session edited are excluded):\n  "
                    + "\n  ".join(tampered)
                    + "\n\nRestore these files and fix the code under test "
                    "instead. If you believe a test is genuinely wrong, say so "
                    "and stop. Do not edit it. That call is the human's, not "
                    "yours.",
                    file=sys.stderr,
                )
                sys.exit(2)
            sys.exit(0)  # green - let it finish

        if GUARD_TEST_EDITS:
            _remember_tests(project_root, session_id)

        output = _clip((result.stdout or "") + "\n" + (result.stderr or ""))
        print(
            "BLOCKED: the tests are not passing, so this turn is not done.\n"
            f"Command: {TEST_COMMAND}\n"
            f"Exit code: {result.returncode}\n\n"
            f"{output}\n\n"
            "Fix the code under test, then try again. Do NOT edit the tests. "
            "If you believe a test is itself wrong, do not change it: say which "
            "test and why, and stop. Deciding that a test is wrong is the "
            "human's call.",
            file=sys.stderr,
        )
        sys.exit(2)

    except subprocess.TimeoutExpired:
        # Do not trap the user because the suite is slow. Say so and allow.
        print(
            f"Test command exceeded {TIMEOUT_SECONDS}s; allowing the stop. "
            "Raise TIMEOUT_SECONDS or scope TEST_COMMAND to a faster subset.",
            file=sys.stderr,
        )
        sys.exit(0)

    except Exception:
        # Fail open. A broken guarantee is better than a bricked session.
        sys.exit(0)


if __name__ == "__main__":
    main()
