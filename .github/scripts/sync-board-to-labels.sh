#!/usr/bin/env bash
# sync-board-to-labels.sh — every card's column becomes its issue's status label.
#
#     sync-board-to-labels.sh [--dry-run]
#
# The board -> label direction. A dragged card is a human decision, so the
# column wins for an OPEN issue. Two rules outrank the column:
#   closed issue  -> last column, `status:` label to match
#   open issue in the last column -> moved back to its label's column, or
#                    the first column if it has none (a reopened issue still
#                    carries the label its close put there)
#
# Dragging a card fires no event Actions can see, which is why this direction
# is a sweep rather than an event handler. The two directions converge: a
# label written here maps back to the very column it was read from.

set -uo pipefail
HERE=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
. "$HERE/board-common.sh"
[ "${1:-}" = "--dry-run" ] && export DRY_RUN=1
FIRST_KEY="${STATUS_KEYS[0]}"
LAST_KEY="${STATUS_KEYS[${#STATUS_KEYS[@]}-1]}"
LAST_COL=$(status_column "$LAST_KEY")

PID=$(project_id)
[ -n "$PID" ] || { echo "No project named '$PROJECT_TITLE' for owner '$OWNER'." >&2; exit 1; }
FIELDS=$(board_fields "$PID")
F_STATUS=$(field_id_from "$FIELDS" "Status")
SEEN=0; CHANGED=0

# Unit separator, not tab: `read` collapses adjacent tabs, which shifts the
# fields of a card that has no Status yet.
while IFS=$'\x1f' read -r NUM STATE COLUMN IID; do
  [ -z "$NUM" ] && continue
  SEEN=$((SEEN + 1))
  if [ "$STATE" = "CLOSED" ]; then
    WANT="$LAST_KEY"
    if [ "$COLUMN" != "$LAST_COL" ]; then
      echo "  #$NUM  closed: $COLUMN -> $LAST_COL${DRY_RUN:+  (dry run)}"
      [ "${DRY_RUN:-0}" = 1 ] || set_board_status "$PID" "$IID" "$F_STATUS" "$(option_id_from "$FIELDS" Status "$LAST_COL")"
      CHANGED=$((CHANGED + 1))
    fi
  elif [ "$COLUMN" = "$LAST_COL" ] || [ -z "$COLUMN" ]; then
    WANT=$(issue_status_label "$NUM")
    if [ -z "$WANT" ] || [ "$WANT" = "$LAST_KEY" ]; then WANT="$FIRST_KEY"; fi
    COL=$(status_column "$WANT")
    echo "  #$NUM  open in '${COLUMN:-no column}': -> $COL${DRY_RUN:+  (dry run)}"
    [ "${DRY_RUN:-0}" = 1 ] || set_board_status "$PID" "$IID" "$F_STATUS" "$(option_id_from "$FIELDS" Status "$COL")"
    CHANGED=$((CHANGED + 1))
  else
    WANT=$(column_status "$COLUMN")
    if [ -z "$WANT" ]; then echo "  #$NUM  column '$COLUMN' maps to no label: skipped"; continue; fi
  fi
  HAVE=$(issue_status_label "$NUM")
  if [ "$HAVE" != "$WANT" ]; then
    echo "  #$NUM  label ${HAVE:-none} -> $WANT${DRY_RUN:+  (dry run)}"
    [ "${DRY_RUN:-0}" = 1 ] || set_issue_status_label "$NUM" "$WANT"
    CHANGED=$((CHANGED + 1))
  fi
done < <(board_items "$PID" | jq -r '
  .data.node.items.nodes[] | select(.content.number != null) | . as $i
  | ([$i.fieldValues.nodes[] | select(.field.name == "Status") | .name] | first // "") as $st
  | [$i.content.number, $i.content.state, $st, $i.id] | map(tostring) | join("\u001f")')

echo "$SEEN card(s) read, $CHANGED change(s)${DRY_RUN:+ would be} made."
