#!/usr/bin/env bash
# sync-pr-to-board.sh — the issues a pull request CLOSES follow the PR.
#
#     sync-pr-to-board.sh <pr-number> [event]      one PR
#     sync-pr-to-board.sh --all                    every open PR
#
# An open, non-draft PR moves its closing issues to `in-review`; a draft, or
# a PR closed unmerged, returns them to `in-progress`. A MERGED PR needs
# nothing: merging closes its issues and the closed-issue rule lands them in
# the last column.
#
# The closing references come from GitHub's own resolution of the PR body
# (`Closes #NN`, `fixes #NN`, or a manually linked issue), read via GraphQL
# because `gh pr view --json closingIssuesReferences` is missing in some gh
# versions.

set -uo pipefail
HERE=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
. "$HERE/board-common.sh"

OWNER_NAME="${REPO%%/*}"; REPO_NAME="${REPO##*/}"
REVIEW_KEY="${REVIEW_KEY:-in-review}"
WORK_KEY="${WORK_KEY:-in-progress}"

sync_one() { # <pr number> <event>
  local PR="$1" EVENT="${2:-}" INFO STATE DRAFT NUMS WANT N
  INFO=$(gh api graphql -f query='
    query($owner: String!, $repo: String!, $pr: Int!) {
      repository(owner: $owner, name: $repo) { pullRequest(number: $pr) {
        state isDraft closingIssuesReferences(first: 50) { nodes { number } } } } }' \
    -f owner="$OWNER_NAME" -f repo="$REPO_NAME" -F pr="$PR" 2>&1)
  if ! echo "$INFO" | jq -e '.data.repository.pullRequest' >/dev/null 2>&1; then
    echo "Could not read PR #$PR:" >&2; echo "$INFO" >&2; return 1
  fi
  STATE=$(echo "$INFO" | jq -r '.data.repository.pullRequest.state')
  DRAFT=$(echo "$INFO" | jq -r '.data.repository.pullRequest.isDraft')
  NUMS=$(echo "$INFO" | jq -r '.data.repository.pullRequest.closingIssuesReferences.nodes[].number')
  if [ "$STATE" = "MERGED" ]; then echo "PR #$PR is merged; its issues close themselves."; return 0; fi
  if [ -z "$NUMS" ]; then echo "PR #$PR closes no issue (add 'Closes #NN' to its body)."; return 0; fi
  WANT="$REVIEW_KEY"
  if [ "$DRAFT" = "true" ] || [ "$EVENT" = "converted_to_draft" ] || [ "$EVENT" = "closed" ] || [ "$STATE" = "CLOSED" ]; then WANT="$WORK_KEY"; fi
  for N in $NUMS; do
    if [ "$(issue_state "$N")" = "CLOSED" ]; then echo "  #$N is closed; left alone."; continue; fi
    CUR=$(issue_status_label "$N")
    if [ "$CUR" = "$WANT" ]; then continue; fi
    # Never pull an issue BACK from a column past review (awaiting
    # verification): a PR that merged earlier and a follow-up PR both point
    # at it, and the later state is the truth.
    if [ "$(status_rank "$CUR")" -gt "$(status_rank "$REVIEW_KEY")" ]; then continue; fi
    echo "  PR #$PR -> #$N: $WANT${DRY_RUN:+  (dry run)}"
    if [ "${DRY_RUN:-0}" != 1 ]; then
      set_issue_status_label "$N" "$WANT"
      bash "$HERE/sync-label-to-board.sh" "$N" labeled "status: $WANT" >/dev/null
    fi
  done
}

if [ "${1:-}" = "--all" ]; then
  [ "${2:-}" = "--dry-run" ] && export DRY_RUN=1
  for PR in $(gh pr list --repo "$REPO" --state open --limit 200 --json number --jq '.[].number'); do sync_one "$PR" ""; done
else
  sync_one "${1:?usage: sync-pr-to-board.sh <pr-number> [event] | --all}" "${2:-}"
fi
