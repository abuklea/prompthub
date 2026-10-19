#!/usr/bin/env bash
# sync-labels.sh — make the repository's labels match labels.json.
#
#     sync-labels.sh [--check] [--prune] [--yes]
#
# For each manifest label: RENAME an existing alias to it (keeps the label on
# every issue), CREATE it if absent, or correct colour/description drift.
# Then list labels the manifest does not name; --prune deletes those (asks
# first unless --yes; a label still on open issues is never deleted).
# --check reports and exits 1 on drift without writing. Idempotent.
#
# Aliases: a manifest entry may carry "aliases": ["bug", "kind/bug"]. The
# first alias found in the repo is renamed to the canonical name. That is how
# an existing project keeps its history when it adopts the taxonomy.

set -uo pipefail
HERE=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
. "$HERE/board-common.sh"

CHECK=0; PRUNE=0; YES=0
for a in "$@"; do
  case "$a" in --check) CHECK=1;; --prune) PRUNE=1;; --yes) YES=1;; esac
done

HAVE=$(gh label list --repo "$REPO" --limit 500 --json name,color,description)
DRIFT=0

have_label() { echo "$HAVE" | jq -e --arg n "$1" '.[] | select(.name==$n)' >/dev/null; }

# Unit separator, not tab: `read` collapses adjacent tabs, so an empty
# description would shift the aliases into the wrong field.
while IFS=$'\x1f' read -r NAME COLOR DESC ALIASES; do
  if ! have_label "$NAME"; then
    RENAMED=0
    IFS=',' read -ra ALS <<< "$ALIASES"
    for AL in "${ALS[@]}"; do
      [ -n "$AL" ] || continue
      if have_label "$AL"; then
        echo "  > $AL  ->  $NAME  (rename, history kept)"; DRIFT=$((DRIFT+1))
        if [ "$CHECK" = 0 ]; then
          gh label edit "$AL" --repo "$REPO" --name "$NAME" --color "$COLOR" --description "$DESC" >/dev/null
          HAVE=$(echo "$HAVE" | jq --arg a "$AL" --arg n "$NAME" '(.[] | select(.name==$a) | .name) = $n')
        fi
        RENAMED=1; break
      fi
    done
    if [ "$RENAMED" = 0 ]; then
      echo "  + $NAME"; DRIFT=$((DRIFT+1))
      if [ "$CHECK" = 0 ]; then gh label create "$NAME" --repo "$REPO" --color "$COLOR" --description "$DESC" >/dev/null; fi
    fi
    continue
  fi
  CUR=$(echo "$HAVE" | jq -r --arg n "$NAME" '.[] | select(.name==$n) | "\(.color | ascii_downcase)\t\(.description // "")"')
  WANT=$(printf '%s\t%s' "$(echo "$COLOR" | tr 'A-F' 'a-f')" "$DESC")
  if [ "$CUR" != "$WANT" ]; then
    echo "  ~ $NAME  (colour or description)"; DRIFT=$((DRIFT+1))
    if [ "$CHECK" = 0 ]; then gh label edit "$NAME" --repo "$REPO" --color "$COLOR" --description "$DESC" >/dev/null; fi
  fi
done < <(jq -r '.labels[] | [.name, .color, (.description // ""), ((.aliases // []) | join(","))] | join("\u001f")' "$LABELS_FILE")

# Labels the manifest neither names nor lists as an alias.
EXTRA=$(comm -23 <(echo "$HAVE" | jq -r '.[].name' | sort) <(jq -r '.labels[] | .name, (.aliases // [])[]' "$LABELS_FILE" | sort))
if [ -n "$EXTRA" ]; then
  echo "Labels not in the manifest (keep, alias, or prune):"
  while read -r L; do
    N=$(gh issue list --repo "$REPO" --state all --label "$L" --limit 1 --json number --jq 'length')
    echo "  ? $L  (in use: $([ "$N" = 0 ] && echo no || echo yes))"
  done <<< "$EXTRA"
  if [ "$PRUNE" = 1 ] && [ "$CHECK" = 0 ]; then
    OK=$YES
    if [ "$OK" = 0 ]; then read -r -p "Delete the UNUSED ones? [y/N] " ans; [ "$ans" = y ] && OK=1; fi
    if [ "$OK" = 1 ]; then
      while read -r L; do
        N=$(gh issue list --repo "$REPO" --state all --label "$L" --limit 1 --json number --jq 'length')
        if [ "$N" = 0 ]; then gh label delete "$L" --repo "$REPO" --yes >/dev/null && echo "  - $L"; else echo "  keep $L (in use)"; fi
      done <<< "$EXTRA"
    fi
  fi
fi

for k in "${STATUS_KEYS[@]}"; do
  if [ -z "$(status_column "$k")" ]; then echo "  ! status: $k has no \"column\" in labels.json"; DRIFT=$((DRIFT+1)); fi
done

if [ "$CHECK" = 1 ]; then echo "$DRIFT change(s) needed."; [ "$DRIFT" -gt 0 ] && exit 1; else echo "$DRIFT change(s) applied."; fi
exit 0
