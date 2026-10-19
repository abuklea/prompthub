#!/usr/bin/env bash
# sync-label-to-board.sh — ONE issue's card follows its labels.
#
#     sync-label-to-board.sh <issue-number> [event] [triggering-label]
#
# Sets the Status column from the `status:` label and every derived field
# (Area / Priority / Size ...) from its prefix label. Adds the issue to the
# board first if it is missing. Run this right after editing an issue's
# labels; board-sync.sh runs the same logic for every open issue.
#
# `event` (opened / reopened / closed / labeled / unlabeled) only decides the
# fallback when the issue carries no status label: a new issue lands in the
# first column, a closed one in the last. `triggering-label` is the label the
# event carried; on `labeled` a STATUS label wins, because the issue may still
# hold the outgoing one too.

set -uo pipefail
HERE=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
. "$HERE/board-common.sh"

NUM="${1:?usage: sync-label-to-board.sh <issue-number> [event] [triggering-label]}"
EVENT="${2:-}"
TRIGGER_LABEL="${3:-}"
FIRST_KEY="${STATUS_KEYS[0]}"
LAST_KEY="${STATUS_KEYS[${#STATUS_KEYS[@]}-1]}"

PID=$(project_id)
[ -n "$PID" ] || { echo "No project named '$PROJECT_TITLE' for owner '$OWNER'." >&2; exit 1; }
FIELDS=$(board_fields "$PID")
F_STATUS=$(field_id_from "$FIELDS" "Status")
[ -n "$F_STATUS" ] || { echo "Project '$PROJECT_TITLE' has no Status field." >&2; exit 1; }
IID=$(board_item_for_issue "$PID" "$NUM")
[ -n "$IID" ] || { echo "Could not place #$NUM on the board." >&2; exit 1; }

# ------------------------------------------------------------------ status --
WANT=""; SYNC_STATUS=1
if [ "$EVENT" = "labeled" ] && [ -n "$TRIGGER_LABEL" ]; then
  CAND="${TRIGGER_LABEL#status: }"
  if [ -n "$(status_column "$CAND")" ]; then WANT="$CAND"; else SYNC_STATUS=0; fi
fi
if [ "$SYNC_STATUS" = 1 ] && [ -z "$WANT" ]; then WANT=$(issue_status_label "$NUM"); fi

if [ "$SYNC_STATUS" = 1 ]; then
  # Open/closed outranks the label: closed -> last column; open -> never it.
  if [ "$(issue_state "$NUM")" = "CLOSED" ]; then
    WANT="$LAST_KEY"
  else
    if [ "$WANT" = "$LAST_KEY" ]; then WANT=""; fi
    if [ -z "$WANT" ]; then
      case "$EVENT" in
        opened|reopened|"") WANT="$FIRST_KEY" ;;
        *) echo "#$NUM has no status label and event '$EVENT' sets no default: column left alone."; SYNC_STATUS=0 ;;
      esac
    fi
  fi
fi

if [ "$SYNC_STATUS" = 1 ]; then
  COLUMN=$(status_column "$WANT")
  OID=$(option_id_from "$FIELDS" "Status" "$COLUMN")
  [ -n "$OID" ] || { echo "Board has no Status column named '$COLUMN'. Run .github/setup-project-board.sh." >&2; exit 1; }
  set_board_status "$PID" "$IID" "$F_STATUS" "$OID"
  set_issue_status_label "$NUM" "$WANT"
  echo "#$NUM -> $COLUMN"
fi

# ---------------------------------------------------------- derived fields --
LABELS=$(issue_label_names "$NUM")
CURRENT=$(board_item_field_values "$(board_items "$PID")" "$IID")
OUT=$(sync_derived_fields "$PID" "$FIELDS" "$IID" "$LABELS" "$CURRENT")
if [ -n "$OUT" ]; then echo "#$NUM derived fields:"; echo "$OUT"; else echo "#$NUM derived fields already match."; fi
