#!/usr/bin/env bash
# sync-derived-fields.sh — every open issue's card fields follow its labels.
#
#     sync-derived-fields.sh [--dry-run]
#
# Puts every open issue on the board (Status from its label, or the first
# column), then sets each derived field (Area / Priority / Size ...) from the
# matching prefix label. Reads the board once and writes only diffs, so a run
# with nothing to do makes no writes.

set -uo pipefail
HERE=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
. "$HERE/board-common.sh"
[ "${1:-}" = "--dry-run" ] && export DRY_RUN=1
FIRST_KEY="${STATUS_KEYS[0]}"

PID=$(project_id)
[ -n "$PID" ] || { echo "No project named '$PROJECT_TITLE' for owner '$OWNER'." >&2; exit 1; }
FIELDS=$(board_fields "$PID")
F_STATUS=$(field_id_from "$FIELDS" "Status")
ITEMS=$(board_items "$PID")
SEEN=0; CHANGED=0; MISSING=0

while IFS=$'\x1f' read -r NUM LABELS; do
  [ -z "$NUM" ] && continue
  SEEN=$((SEEN + 1))
  IID=$(echo "$ITEMS" | jq -r --argjson n "$NUM" '.data.node.items.nodes[] | select(.content.number==$n) | .id')
  CURRENT=""
  if [ -z "$IID" ]; then
    echo "  #$NUM  not on the board${DRY_RUN:+  (dry run: would add)}"
    if [ "${DRY_RUN:-0}" = 1 ]; then continue; fi
    IID=$(board_item_for_issue "$PID" "$NUM")
    if [ -z "$IID" ]; then MISSING=$((MISSING + 1)); continue; fi
    WANT=$(derived_value_from_labels "$LABELS" status); [ -n "$WANT" ] || WANT="$FIRST_KEY"
    set_board_status "$PID" "$IID" "$F_STATUS" "$(option_id_from "$FIELDS" Status "$(status_column "$WANT")")"
    set_issue_status_label "$NUM" "$WANT"
    echo "    Status: -> $(status_column "$WANT")"
    CHANGED=$((CHANGED + 1))
  else
    CURRENT=$(board_item_field_values "$ITEMS" "$IID")
    if ! echo "$CURRENT" | grep -q '^Status='; then
      WANT=$(derived_value_from_labels "$LABELS" status); [ -n "$WANT" ] || WANT="$FIRST_KEY"
      echo "  #$NUM  no Status: -> $(status_column "$WANT")${DRY_RUN:+  (dry run)}"
      if [ "${DRY_RUN:-0}" != 1 ]; then
        set_board_status "$PID" "$IID" "$F_STATUS" "$(option_id_from "$FIELDS" Status "$(status_column "$WANT")")"
        set_issue_status_label "$NUM" "$WANT"
      fi
      CHANGED=$((CHANGED + 1))
    fi
  fi
  OUT=$(sync_derived_fields "$PID" "$FIELDS" "$IID" "$LABELS" "$CURRENT")
  if [ -n "$OUT" ]; then echo "  #$NUM"; echo "$OUT"; CHANGED=$((CHANGED + 1)); fi
done < <(gh issue list --repo "$REPO" --state open --limit 500 --json number,labels \
           --jq '.[] | "\(.number)\u001f\([.labels[].name] | join(","))"')

echo "$SEEN open issue(s) read, $CHANGED card(s) ${DRY_RUN:+would be }corrected, $MISSING unplaceable."
