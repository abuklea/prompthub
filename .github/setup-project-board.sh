#!/usr/bin/env bash
# setup-project-board.sh — create or repair the Projects v2 board.
#
#     setup-project-board.sh [--force-options]
#
# Finds or creates the project named PROJECT_TITLE, sets the Status columns
# from the `status:` labels in labels.json, creates one single-select field
# per derived prefix (Priority / Size / Area ...) with options and colours
# from the same file, and files every open issue. Idempotent.
#
# DANGER it guards against: updateProjectV2Field REPLACES a single-select's
# options and mints new option ids, which clears that field on every card.
# So options are rewritten only when the field is NEW, or when the names
# differ AND --force-options is given. Missing options on an existing field
# are reported, never silently added.
#
# Requires the project scope: gh auth refresh -s project,read:project -h github.com

set -euo pipefail
HERE=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
. "$HERE/scripts/board-common.sh"
FORCE=0; [ "${1:-}" = "--force-options" ] && FORCE=1

command -v gh >/dev/null || { echo "gh CLI not found"; exit 1; }
command -v jq >/dev/null || { echo "jq not found"; exit 1; }
gh project list --owner "$OWNER" --limit 1 >/dev/null 2>&1 || { echo "Token lacks the project scope: gh auth refresh -s project,read:project -h github.com"; exit 1; }

# ---------------------------------------------------------------- project ----
NUM=$(project_number)
if [ -z "$NUM" ]; then
  echo "Creating project '$PROJECT_TITLE' for $OWNER ..."
  NUM=$(gh project create --owner "$OWNER" --title "$PROJECT_TITLE" --format json | jq -r '.number')
else
  echo "Project '$PROJECT_TITLE' exists (#$NUM)."
fi
PID=$(gh project view "$NUM" --owner "$OWNER" --format json | jq -r '.id')
ITEMS=$(gh project view "$NUM" --owner "$OWNER" --format json | jq -r '.items.totalCount // 0')
echo "Project number $NUM  id $PID  items $ITEMS"
# A board with no cards has no values to lose: its options (including the
# default Status Todo/In Progress/Done) are rewritten freely.
if [ "$ITEMS" = 0 ]; then FORCE=1; echo "Empty board: field options will be set from labels.json."; fi

# options json for a prefix: [{name,color,description}]
options_for() {
  jq -c --arg p "$1: " '[.labels[] | select(.name | startswith($p)) | {name: (.name | sub("^" + $p; "")), color: (.boardColor // "GRAY"), description: (.column_description // .description // "")}]' "$LABELS_FILE"
}
status_options() {
  jq -c '[.labels[] | select(.name | startswith("status: ")) | {name: .column, color: (.boardColor // "GRAY"), description: (.description // "" | sub("^Board column: "; ""))}]' "$LABELS_FILE"
}
write_options() {  # <field id> <options json>
  local BODY; BODY=$(mktemp)
  jq -n --arg fid "$1" --argjson opts "$2" '{
    query: "mutation($fid: ID!, $opts: [ProjectV2SingleSelectFieldOptionInput!]!) { updateProjectV2Field(input: { fieldId: $fid, singleSelectOptions: $opts }) { projectV2Field { ... on ProjectV2SingleSelectField { id } } } }",
    variables: { fid: $fid, opts: $opts } }' > "$BODY"
  gh api graphql --input "$BODY" >/dev/null
  rm -f "$BODY"
}
ensure_field() {  # <field name> <options json>
  local NAME="$1" OPTS="$2" FIELDS FID HAVE WANT
  FIELDS=$(board_fields "$PID")
  FID=$(field_id_from "$FIELDS" "$NAME")
  WANT=$(echo "$OPTS" | jq -r '[.[].name] | join(",")')
  if [ -z "$FID" ]; then
    gh project field-create "$NUM" --owner "$OWNER" --name "$NAME" --data-type SINGLE_SELECT --single-select-options "$WANT" >/dev/null
    FIELDS=$(board_fields "$PID"); FID=$(field_id_from "$FIELDS" "$NAME")
    write_options "$FID" "$OPTS"       # a new field has no values: safe to colour
    echo "  field '$NAME' created: $WANT"
    return
  fi
  HAVE=$(echo "$FIELDS" | jq -r --arg n "$NAME" '.data.node.fields.nodes[] | select(.name==$n) | [.options[].name] | join(",")')
  if [ "$HAVE" = "$WANT" ]; then echo "  field '$NAME' options already correct"; return; fi
  if [ "$FORCE" = 1 ]; then
    echo "  field '$NAME': REWRITING options ($HAVE -> $WANT). Existing values on cards are cleared; run board-sync.sh after."
    write_options "$FID" "$OPTS"
  else
    echo "  field '$NAME' differs:"
    echo "      board:    $HAVE"
    echo "      manifest: $WANT"
    echo "      Either edit labels.json to match the board, add the option in the board UI (keeps ids), or re-run with --force-options."
  fi
}

echo "Status columns ..."
ensure_field "Status" "$(status_options)"
echo "Derived fields ..."
for pair in "${DERIVED_FIELDS[@]}"; do
  prefix="${pair%%:*}"; fname="${pair#*:}"
  ensure_field "$fname" "$(options_for "$prefix")"
done

echo "Adding open issues ..."
gh issue list --repo "$REPO" --state open --limit 500 --json url --jq '.[].url' | while read -r U; do
  if gh project item-add "$NUM" --owner "$OWNER" --url "$U" >/dev/null 2>&1; then echo "  on board  $U"; else echo "  FAILED    $U"; fi
done

echo "Syncing fields from labels ..."
bash "$HERE/scripts/sync-derived-fields.sh"

cat <<NOTE

Done. Next:
  - Views cannot be created by API. In the browser open project #$NUM and add:
      Board  (layout Board, group by Status, show Priority + Size + Milestone + Sub-issues progress on cards)
      Priority  (layout Board, group by Priority)
      Milestones  (layout Table or Roadmap, group by Milestone)
  - Run .github/scripts/board-sync.sh whenever labels, cards or PRs change.
NOTE
