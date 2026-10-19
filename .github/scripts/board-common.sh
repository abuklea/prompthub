#!/usr/bin/env bash
# board-common.sh — sourced by every board script; never executed directly.
#
# THE one mapping between issue labels and the project board. Everything is
# derived from labels.json (the taxonomy) so no two scripts can disagree.
# Runs with the developer's own `gh` login: no Actions and no stored token
# are required.
#
# Requires: gh (>= 2.40), jq. Auth scopes: repo + project
#   (gh auth refresh -s project,read:project -h github.com)

OWNER="${OWNER:-abuklea}"
REPO="${REPO:-abuklea/prompthub}"
PROJECT_TITLE="${PROJECT_TITLE:-PromptHub}"
HERE_COMMON=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
LABELS_FILE="${LABELS_FILE:-$HERE_COMMON/../labels.json}"
if [ ! -f "$LABELS_FILE" ]; then
  echo "labels.json not found at $LABELS_FILE" >&2
  return 1 2>/dev/null || exit 1
fi

# ------------------------------------------------------------ status map ----
# Label suffix -> column name comes from each `status:` label's "column"
# field, in file order (which is the column order).
mapfile -t STATUS_KEYS < <(jq -r '.labels[] | select(.name | startswith("status: ")) | .name | sub("^status: "; "")' "$LABELS_FILE")

status_column() {  # label suffix -> column name ("" if unknown)
  jq -r --arg k "status: $1" '.labels[] | select(.name==$k) | .column // ""' "$LABELS_FILE"
}
column_status() {  # column name -> label suffix ("" if unknown)
  jq -r --arg c "$1" '.labels[] | select(.column==$c) | .name | sub("^status: "; "")' "$LABELS_FILE"
}
status_rank() {    # position in the column order; the most advanced wins a tie
  local i
  for i in "${!STATUS_KEYS[@]}"; do
    if [ "${STATUS_KEYS[$i]}" = "$1" ]; then echo "$i"; return; fi
  done
  echo -1
}

# Derived single-select fields: "<prefix>:<field>" for every prefix that names
# a board field other than Status. Status is the one field a person may set
# on the board directly.
mapfile -t DERIVED_FIELDS < <(jq -r '.prefixes | to_entries[] | select(.value.field != null and .value.field != "Status") | "\(.key):\(.value.field)"' "$LABELS_FILE")

# Option names for a prefix, in manifest order.
label_values() {
  jq -r --arg p "$1: " '.labels[] | select(.name | startswith($p)) | .name | sub("^" + $p; "")' "$LABELS_FILE"
}

# ---------------------------------------------------------------- lookups ----
project_number() {
  gh project list --owner "$OWNER" --limit 100 --format json \
    | jq -r --arg t "$PROJECT_TITLE" '.projects[] | select(.title==$t) | .number' | head -1
}
project_id() {
  gh project list --owner "$OWNER" --limit 100 --format json \
    | jq -r --arg t "$PROJECT_TITLE" '.projects[] | select(.title==$t) | .id' | head -1
}

board_fields() {  # all fields + single-select options, fetched once per run
  gh api graphql -f query='
    query($id: ID!) { node(id: $id) { ... on ProjectV2 {
      fields(first: 50) { nodes {
        ... on ProjectV2Field { id name }
        ... on ProjectV2SingleSelectField { id name options { id name } }
      } } } } }' -f id="$1"
}
field_id_from() {
  echo "$1" | jq -r --arg n "$2" '.data.node.fields.nodes[] | select(.name==$n) | .id'
}
option_id_from() {
  if [ -z "${3:-}" ]; then return 0; fi
  echo "$1" | jq -r --arg n "$2" --arg o "$3" '.data.node.fields.nodes[] | select(.name==$n) | .options[] | select(.name==$o) | .id'
}

# Every board item, paginated, as one JSON document. Issue items only: a pull
# request item's number must never be mistaken for an issue's.
board_items() {
  local pid="$1" cursor="" page
  local all='{"data":{"node":{"items":{"nodes":[]}}}}'
  while :; do
    if [ -n "$cursor" ]; then
      page=$(gh api graphql -f query="$BOARD_ITEMS_QUERY" -f id="$pid" -f after="$cursor")
    else
      page=$(gh api graphql -f query="$BOARD_ITEMS_QUERY" -f id="$pid")
    fi
    all=$(jq -s '.[0].data.node.items.nodes += ([.[1].data.node.items.nodes[] | select(.content.__typename=="Issue")]) | .[0]' \
          <(echo "$all") <(echo "$page"))
    if [ "$(echo "$page" | jq -r '.data.node.items.pageInfo.hasNextPage')" != "true" ]; then break; fi
    cursor=$(echo "$page" | jq -r '.data.node.items.pageInfo.endCursor')
  done
  echo "$all"
}
BOARD_ITEMS_QUERY='
  query($id: ID!, $after: String) { node(id: $id) { ... on ProjectV2 {
    items(first: 100, after: $after) {
      pageInfo { hasNextPage endCursor }
      nodes { id
        content { __typename ... on Issue { number state } }
        fieldValues(first: 20) { nodes {
          ... on ProjectV2ItemFieldSingleSelectValue { name field { ... on ProjectV2SingleSelectField { name } } }
        } } } } } } }'

# Item id for an issue; adds the issue to the board first if it is missing.
# `item-add` is idempotent server-side, and its OWN response is used because
# the item list lags a write by seconds.
board_item_for_issue() {
  local pid="$1" num="$2" iid
  iid=$(board_items "$pid" | jq -r --argjson n "$num" '.data.node.items.nodes[] | select(.content.number==$n) | .id')
  if [ -z "$iid" ]; then
    iid=$(gh project item-add "$(project_number)" --owner "$OWNER" \
          --url "https://github.com/$REPO/issues/$num" --format json | jq -r '.id // ""')
  fi
  echo "$iid"
}
set_board_status() {  # <pid> <item id> <field id> <option id>
  if [ -z "$4" ]; then return 0; fi
  gh project item-edit --id "$2" --project-id "$1" --field-id "$3" --single-select-option-id "$4" >/dev/null
}

# One card's single-select values as "<field>=<option>" lines.
board_item_field_values() {
  echo "$1" | jq -r --arg id "$2" '.data.node.items.nodes[] | select(.id==$id) | .fieldValues.nodes[] | select(.field.name != null) | "\(.field.name)=\(.name)"'
}

# ----------------------------------------------------------------- labels ----
issue_label_names() { gh issue view "$1" --repo "$REPO" --json labels --jq '[.labels[].name] | join(",")'; }
issue_node_id()     { gh issue view "$1" --repo "$REPO" --json id --jq '.id'; }
issue_state()       { gh issue view "$1" --repo "$REPO" --json state --jq '.state'; }

# The most advanced `status:` suffix on the issue, or "". Two can coexist for
# the moment between adding the new one and removing the old; forward wins.
issue_status_label() {
  local have k best="" r br=-1
  have=$(gh issue view "$1" --repo "$REPO" --json labels --jq '[.labels[].name | select(startswith("status: "))] | join(",")')
  for k in "${STATUS_KEYS[@]}"; do
    if [[ ",$have," == *",status: $k,"* ]]; then
      r=$(status_rank "$k")
      if [ "$r" -gt "$br" ]; then best="$k"; br=$r; fi
    fi
  done
  echo "$best"
}

# Leave exactly one status label on the issue. A no-op when already so, so it
# never churns the issue timeline.
set_issue_status_label() {
  local num="$1" want="$2" have k
  have=$(gh issue view "$num" --repo "$REPO" --json labels --jq '[.labels[].name | select(startswith("status: "))] | join(",")')
  for k in "${STATUS_KEYS[@]}"; do
    if [ "$k" != "$want" ] && [[ ",$have," == *",status: $k,"* ]]; then
      gh issue edit "$num" --repo "$REPO" --remove-label "status: $k" >/dev/null
    fi
  done
  if [ -n "$want" ] && [[ ",$have," != *",status: $want,"* ]]; then
    gh issue edit "$num" --repo "$REPO" --add-label "status: $want" >/dev/null
  fi
  return 0
}

# ensure_label <num> <label> <on|off>: add or remove one label, printing a
# line only when something changed.
ensure_label() {
  local have; have=$(issue_label_names "$1")
  if [ "$3" = "on" ] && [[ ",$have," != *",$2,"* ]]; then
    if [ "${DRY_RUN:-0}" != "1" ]; then gh issue edit "$1" --repo "$REPO" --add-label "$2" >/dev/null; fi
    echo "  #$1  +$2${DRY_RUN:+  (dry run)}"
  fi
  if [ "$3" = "off" ] && [[ ",$have," == *",$2,"* ]]; then
    if [ "${DRY_RUN:-0}" != "1" ]; then gh issue edit "$1" --repo "$REPO" --remove-label "$2" >/dev/null; fi
    echo "  #$1  -$2${DRY_RUN:+  (dry run)}"
  fi
}

# --------------------------------------------------------- derived fields ----
# The value a derived field should hold: the FIRST label with that prefix in
# the issue's own label order. Empty when there is none.
derived_value_from_labels() {
  echo "$1" | tr ',' '\n' | grep "^$2: " | head -1 | sed "s/^$2: //" || true
}

# Set every derived field on one card from the issue's labels. Writes only
# diffs, clears a field whose label is gone, prints one line per change.
# DRY_RUN=1 prints without writing. Sets DERIVED_CHANGED.
sync_derived_fields() { # <pid> <fields json> <item id> <labels csv> <current "F=V" lines>
  local pid="$1" fields="$2" iid="$3" labels="$4" current="$5"
  local pair prefix fname fid want have oid
  DERIVED_CHANGED=0
  for pair in "${DERIVED_FIELDS[@]}"; do
    prefix="${pair%%:*}"; fname="${pair#*:}"
    fid=$(field_id_from "$fields" "$fname")
    if [ -z "$fid" ]; then continue; fi
    want=$(derived_value_from_labels "$labels" "$prefix")
    have=$(echo "$current" | awk -v f="$fname" 'index($0, f"=")==1 {print substr($0, length(f)+2); exit}')
    if [ "$want" = "$have" ]; then continue; fi
    if [ "${DRY_RUN:-0}" != "1" ]; then
      if [ -z "$want" ]; then
        gh project item-edit --id "$iid" --project-id "$pid" --field-id "$fid" --clear >/dev/null
      else
        oid=$(option_id_from "$fields" "$fname" "$want")
        if [ -z "$oid" ]; then
          echo "    $fname has no option '$want': run .github/setup-project-board.sh" >&2
          continue
        fi
        gh project item-edit --id "$iid" --project-id "$pid" --field-id "$fid" --single-select-option-id "$oid" >/dev/null
      fi
    fi
    echo "    $fname: ${have:-none} -> ${want:-none}${DRY_RUN:+  (dry run)}"
    DERIVED_CHANGED=$((DERIVED_CHANGED + 1))
  done
  return 0
}
