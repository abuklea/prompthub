#!/usr/bin/env bash
# board-sync.sh — the ONE local command that brings labels, board, pull
# requests and relationships into agreement. No GitHub Actions needed: it
# runs with the developer's own `gh` login in a few seconds.
#
#     board-sync.sh [--dry-run] [--no-link]
#
# Run it at the start and end of a work session, after a batch of label
# edits, or from a git hook / local scheduler (see the conventions doc).
# The optional Actions workflows call the same scripts on events.
#
# Order matters; each step's rule outranks the one after it:
#   1. sync-board-to-labels   closed -> last column; a dragged card wins for
#                             an open issue; the label follows the column
#   2. sync-pr-to-board       an open PR puts its closing issues in review
#   3. sync-derived-fields    every open issue is on the board; Area /
#                             Priority / Size ... follow the labels
#   4. sync-relationships     checkboxes, sub-issues, blockers, flag: blocked

set -uo pipefail
HERE=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
. "$HERE/board-common.sh"

DRY=""; NOLINK=""
for a in "$@"; do
  case "$a" in --dry-run) DRY="--dry-run" ;; --no-link) NOLINK="--no-link" ;; esac
done

command -v gh >/dev/null || { echo "gh CLI not found"; exit 1; }
command -v jq >/dev/null || { echo "jq not found"; exit 1; }
if ! gh project list --owner "$OWNER" --limit 1 >/dev/null 2>&1; then
  echo "Token lacks the project scope. Run: gh auth refresh -s project,read:project -h github.com" >&2; exit 1
fi
[ -n "$(project_id)" ] || { echo "No project named '$PROJECT_TITLE' for '$OWNER'. Run .github/setup-project-board.sh first." >&2; exit 1; }

echo "== 1/4 board columns -> status labels"
bash "$HERE/sync-board-to-labels.sh" $DRY
echo "== 2/4 open pull requests -> in review"
bash "$HERE/sync-pr-to-board.sh" --all $DRY
echo "== 3/4 labels -> board fields"
bash "$HERE/sync-derived-fields.sh" $DRY
echo "== 4/4 checkboxes, sub-issues, blockers"
bash "$HERE/sync-relationships.sh" --all $DRY $NOLINK
echo "== done"
