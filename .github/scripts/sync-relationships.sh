#!/usr/bin/env bash
# sync-relationships.sh — parents, sub-issues, checkboxes and blockers agree.
#
#     sync-relationships.sh --all [--dry-run] [--no-link]
#     sync-relationships.sh --issue <n> [--dry-run] [--no-link]
#
# For every open issue (or the one named, plus the parents that list it):
#   1. Task-list lines that reference an issue (`- [ ] #12`, `owner/repo#12`,
#      or an issue URL) are ticked when that issue is CLOSED and unticked when
#      it is OPEN. Plain-text boxes are left alone: the PR that delivers one
#      ticks it.
#   2. Each referenced issue is linked as a SUB-ISSUE of the parent (the
#      Relationships section, and the board's "Sub-issues progress" field).
#      Skipped with --no-link. An issue already parented elsewhere is reported,
#      not stolen.
#   3. `Blocked by #NN` in the body becomes a blocked-by dependency (the
#      Relationships section), and `flag: blocked` is set while ANY blocker is
#      open and removed once none is.
#   4. A parent whose sub-issues are all closed but which is still open is
#      reported as "ready to close". A closed parent with an open box is
#      reported as a defect. Nothing is closed or reopened automatically.

set -uo pipefail
HERE=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
. "$HERE/board-common.sh"

MODE=""; ONE=""; LINK=1
while [ $# -gt 0 ]; do
  case "$1" in
    --all) MODE=all ;;
    --issue) MODE=one; ONE="$2"; shift ;;
    --dry-run) export DRY_RUN=1 ;;
    --no-link) LINK=0 ;;
    *) echo "unknown argument $1" >&2; exit 2 ;;
  esac
  shift
done
[ -n "$MODE" ] || { echo "usage: sync-relationships.sh --all | --issue <n> [--dry-run] [--no-link]" >&2; exit 2; }

OWNER_NAME="${REPO%%/*}"; REPO_NAME="${REPO##*/}"
REF_RE="(#|${REPO}#|https://github\.com/${REPO}/issues/)([0-9]+)"

issue_info() {  # body, state, node id, sub-issues, blockers — one query
  gh api graphql -f query='
    query($owner: String!, $repo: String!, $n: Int!) {
      repository(owner: $owner, name: $repo) { issue(number: $n) {
        id state body
        parent { number }
        subIssues(first: 100) { nodes { number state } }
        blockedBy(first: 50) { nodes { number state } }
      } } }' -f owner="$OWNER_NAME" -f repo="$REPO_NAME" -F n="$1"
}
states_of() {  # batch: numbers -> "n STATE id parent-or-dash" lines; a number that is
               # not an issue (a PR, a deleted issue) is simply absent
  local q="" n
  for n in "$@"; do q="$q i$n: issue(number: $n) { number state id parent { number } }"; done
  [ -n "$q" ] || return 0
  gh api graphql -f query="query(\$owner: String!, \$repo: String!) { repository(owner: \$owner, name: \$repo) { $q } }" \
    -f owner="$OWNER_NAME" -f repo="$REPO_NAME" 2>/dev/null \
    | jq -r '.data.repository // {} | to_entries[] | .value | select(. != null) | "\(.number) \(.state) \(.id) \(.parent.number // "-")"'
}
add_sub_issue() {  # <parent node id> <child node id> — errors (already linked) are reported not fatal
  gh api graphql -f query='mutation($p: ID!, $c: ID!) { addSubIssue(input: {issueId: $p, subIssueId: $c}) { issue { number } } }' \
    -f p="$1" -f c="$2" >/dev/null 2>&1
}
add_blocked_by() {
  gh api graphql -f query='mutation($i: ID!, $b: ID!) { addBlockedBy(input: {issueId: $i, blockingIssueId: $b}) { issue { number } } }' \
    -f i="$1" -f b="$2" >/dev/null 2>&1
}

CHANGED=0
process() {  # <issue number>
  local NUM="$1" INFO BODY STATE NID NEW REFS LINE N ST CID BLOCKERS OPEN_BLOCK=0 SUBS_TOTAL SUBS_CLOSED
  INFO=$(issue_info "$NUM")
  BODY=$(echo "$INFO" | jq -r '.data.repository.issue.body // ""')
  STATE=$(echo "$INFO" | jq -r '.data.repository.issue.state')
  NID=$(echo "$INFO" | jq -r '.data.repository.issue.id')

  # 1 + 2: referenced task-list lines
  REFS=$(echo "$BODY" | grep -E "^[[:space:]]*[-*] \[[ xX]\] " | grep -oE "${REF_RE}" | head -200 | sed -E "s/.*[#/]([0-9]+)$/\1/" | sort -un || true)
  if [ -n "$REFS" ]; then
    declare -A CST=() CID_OF=() CPARENT=()
    while read -r N ST CID CP; do CST[$N]=$ST; CID_OF[$N]=$CID; CPARENT[$N]=$CP; done < <(states_of $REFS)
    NEW=""
    while IFS= read -r LINE; do
      if [[ "$LINE" =~ ^([[:space:]]*[-*])\ \[([ xX])\]\ (.*)$ ]]; then
        N=$(echo "${BASH_REMATCH[3]}" | grep -oE "${REF_RE}" | head -1 | sed -E "s/.*[#/]([0-9]+)$/\1/")
        if [ -n "$N" ] && [ -n "${CST[$N]:-}" ]; then
          if [ "${CST[$N]}" = "CLOSED" ]; then LINE="${BASH_REMATCH[1]} [x] ${BASH_REMATCH[3]}"; else LINE="${BASH_REMATCH[1]} [ ] ${BASH_REMATCH[3]}"; fi
        fi
      fi
      NEW+="$LINE"$'\n'
    done <<< "$BODY"
    NEW="${NEW%$'\n'}"
    if [ "$NEW" != "$BODY" ]; then
      echo "  #$NUM  checkboxes updated${DRY_RUN:+  (dry run)}"
      if [ "${DRY_RUN:-0}" != 1 ]; then gh issue edit "$NUM" --repo "$REPO" --body-file <(printf '%s' "$NEW") >/dev/null; fi
      CHANGED=$((CHANGED + 1))
    fi
    if [ "$LINK" = 1 ] && [ "$STATE" = "OPEN" ]; then
      for N in $REFS; do
        [ "$N" = "$NUM" ] && continue
        [ -n "${CST[$N]:-}" ] || continue        # not an issue (a PR number): nothing to link
        if echo "$INFO" | jq -e --argjson n "$N" '.data.repository.issue.subIssues.nodes[] | select(.number==$n)' >/dev/null; then continue; fi
        PARENT="${CPARENT[$N]:-}"
        if [ -n "$PARENT" ] && [ "$PARENT" != "-" ] && [ "$PARENT" != "$NUM" ]; then echo "  #$NUM  #$N already a sub-issue of #$PARENT: not re-parented"; continue; fi
        echo "  #$NUM  link sub-issue #$N${DRY_RUN:+  (dry run)}"
        if [ "${DRY_RUN:-0}" != 1 ]; then add_sub_issue "$NID" "${CID_OF[$N]}" || echo "  #$NUM  could not link #$N (limit 100 per parent, 8 levels)"; fi
        CHANGED=$((CHANGED + 1))
      done
    fi
    unset CST CID_OF CPARENT
  fi

  # 3: blockers from the body, and the flag from the live relationship
  if [ "$STATE" = "OPEN" ]; then
    # Only a statement: `Blocked by #NN` (capital B) starting a line, a list
    # item or a sentence. Prose such as "was blocked by #12" is history and is
    # ignored. Minus the issue itself and its own task-list children: an epic
    # "blocked by" its children is progress, not a dependency.
    BLOCKERS=$(echo "$BODY" | grep -oE "(^|^[[:space:]]*[-*] |\. |^\*\*)Blocked by[^.]*" | grep -oE "${REF_RE}" | sed -E "s/.*[#/]([0-9]+)$/\1/" | sort -un || true)
    for N in $BLOCKERS; do
      [ "$N" = "$NUM" ] && continue
      if [ -n "$REFS" ] && echo "$REFS" | grep -qx "$N"; then continue; fi
      if echo "$INFO" | jq -e --argjson n "$N" '.data.repository.issue.blockedBy.nodes[] | select(.number==$n)' >/dev/null; then continue; fi
      read -r _ BST BID _ < <(states_of "$N")
      [ -n "${BID:-}" ] || { echo "  #$NUM  'Blocked by #$N' names no issue"; continue; }
      echo "  #$NUM  add blocked-by #$N${DRY_RUN:+  (dry run)}"
      if [ "${DRY_RUN:-0}" != 1 ]; then
        add_blocked_by "$NID" "$BID" || echo "  #$NUM  could not add blocker #$N"
        INFO=$(issue_info "$NUM")
      elif [ "$BST" = "OPEN" ]; then
        OPEN_BLOCK=1     # dry run: judge the flag as if the link existed
      fi
      CHANGED=$((CHANGED + 1))
    done
    if echo "$INFO" | jq -e '.data.repository.issue.blockedBy.nodes[] | select(.state=="OPEN")' >/dev/null; then OPEN_BLOCK=1; fi
    if [ "$OPEN_BLOCK" = 1 ]; then ensure_label "$NUM" "flag: blocked" on; else ensure_label "$NUM" "flag: blocked" off; fi
  fi

  # 4: reports
  SUBS_TOTAL=$(echo "$INFO" | jq '.data.repository.issue.subIssues.nodes | length')
  SUBS_CLOSED=$(echo "$INFO" | jq '[.data.repository.issue.subIssues.nodes[] | select(.state=="CLOSED")] | length')
  if [ "$STATE" = "OPEN" ] && [ "$SUBS_TOTAL" -gt 0 ] && [ "$SUBS_TOTAL" = "$SUBS_CLOSED" ]; then
    if ! echo "$BODY" | grep -qE '^[[:space:]]*[-*] \[ \] '; then echo "  #$NUM  READY TO CLOSE: all $SUBS_TOTAL sub-issues closed, no open box"; fi
  fi
  if [ "$STATE" = "CLOSED" ] && echo "$BODY" | grep -qE '^[[:space:]]*[-*] \[ \] '; then
    echo "  #$NUM  DEFECT: closed with an open checkbox"
  fi
}

if [ "$MODE" = one ]; then
  process "$ONE"
  # parents that list this issue in a task line
  for P in $(gh issue list --repo "$REPO" --state all --limit 500 --json number,body \
             | jq -r --arg re "(^|\\n)[[:space:]]*[-*] \\[[ xX]\\] [^\\n]*#${ONE}([^0-9]|\\n|$)" '.[] | select(.body // "" | test($re)) | .number'); do
    [ "$P" = "$ONE" ] || process "$P"
  done
else
  for N in $(gh issue list --repo "$REPO" --state open --limit 500 --json number --jq '.[].number'); do process "$N"; done
fi
echo "$CHANGED change(s)${DRY_RUN:+ would be} made."
