#!/usr/bin/env bash
# Project: PromptHub
# Author: Allan James
# Source: scripts/find-old-size-rules.sh
# MIME: text/x-shellscript
# Type: Bash script (bash 4+)
#
# Created: 19/10/2026 18:43 GMT+10
# Last modified: 19/10/2026 18:43 GMT+10
# ---------------
# Inventory, or verify the absence of, legacy size-rule wording (docs/rules/code-size.md). Installed by the
# adopt-code-size-rules skill; tailor only the PROJECT CONFIGURATION block.
#
# Changelog:
# 19/10/2026 18:43 GMT+10 | Installed by adopt-code-size-rules; project header added, --help reads the usage block
#
# find-old-size-rules.sh - inventory, or verify the absence of, legacy file-size rule wording.
#
# Scans the surfaces an agent reads as rules (CLAUDE.md, AGENTS.md, docs/rules, .claude,
# .cursor, and so on) and the header comments of source files for wording that belongs to
# a hard per-file line cap, a fixed chars-per-line rule, or the old audit script and
# exceptions register. Generated mirrors and dated history are reported separately.
#
# Usage:
#   scripts/find-old-size-rules.sh            # inventory
#   scripts/find-old-size-rules.sh --verify   # exit 1 if any legacy wording remains
#   scripts/find-old-size-rules.sh --history  # inventory, plus dated records
#
# Exit status: 0 clean (or inventory mode), 1 when --verify finds legacy wording on a
# rule surface or in source, 2 on a bad option.

set -euo pipefail
export LC_ALL=C

# ---------------------------------------------------------------------------
# PROJECT CONFIGURATION - tailor these for the project
# ---------------------------------------------------------------------------
RULE_SURFACES=(                  # what an agent reads as instructions
    CLAUDE.md AGENTS.md GEMINI.md CONTEXT.md README.md CONTRIBUTING.md
    .claude .agents .cursor .cursorrules .windsurfrules .clinerules
    .github/copilot-instructions.md .github/workflows docs/rules scripts
)
SOURCE_ROOTS=(src)               # hand-written code whose comments may cite the old rule
SOURCE_EXTENSIONS=(ts tsx js jsx py css sh)
GENERATED_MIRRORS=(.gemini)      # regenerate these, never hand-edit
HISTORY_PATHS=(wip PRPs docs/dev docs/superpowers docs/tasks .serena/memories CHANGELOG.md)
NEW_RULE_FILES=(                 # the methodology's own files; they name the bands legitimately
    docs/rules/code-size.md docs/rules/code-size-register.md
    scripts/audit-code-size.sh scripts/find-old-size-rules.sh
)
IGNORE_GLOBS=(                   # known false positives: generic skills, worktree copies
    '.claude/worktrees/*' '*/skills/build-dark-factory/*' '*/skills/skill-creator/*'
)
# A line that starts with a date stamp is a changelog entry, and a deeply indented line inside
# a header is that entry's wrapped continuation: history, never reworded.
DATED_LINE='^[^:]+:[0-9]+:[[:space:]]*(#|//|\*)?[[:space:]]*[0-9]{2}/[0-9]{2}/[0-9]{4} [0-9]{2}:[0-9]{2}'
CONTINUATION_LINE='^[^:]+:[0-9]+:[[:space:]]{16,}'

# Environment overrides let the skill's master copy run before a project copy
# is installed: FIND_SOURCE_ROOTS="frontend/src backend" FIND_RULE_SURFACES="..."
[[ -n "${FIND_SOURCE_ROOTS:-}" ]] && read -ra SOURCE_ROOTS <<< "$FIND_SOURCE_ROOTS"
[[ -n "${FIND_RULE_SURFACES:-}" ]] && read -ra RULE_SURFACES <<< "$FIND_RULE_SURFACES"

# ---------------------------------------------------------------------------
# LEGACY WORDING - the patterns; extend only with wording seen in the wild
# ---------------------------------------------------------------------------
LEGACY_PATTERNS=(
    '[0-9]{3,4}[- ]line (limit|rule|max|maximum|cap|budget|policy|violation|compliance)'
    '(max|maximum|under|below|exceed|exceeds|exceeding|over|within) ?(the )?[0-9]{3,4} lines'
    'lines per (file|function)'
    '(chars|characters) per line'
    'file[- ]length (limit|rule|policy|budget|register|exception|compliance|audit)'
    'file-length-exceptions'
    'audit-file-lengths'
    'line[- ]length limit'
    'strictly enforced.*lines'
)
INFO_PATTERNS='line-length|max-len|max_line_length|printWidth|max-lines|max-depth|max-complexity'

# ---------------------------------------------------------------------------
PROJECT_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$PROJECT_ROOT"
MODE="${1:-inventory}"
case "$MODE" in
    inventory|--verify|--history) ;;
    -h|--help) sed -n '/^# find-old-size-rules.sh - /,/^# rule surface or in source/p' "$0"; exit 0 ;;
    *) echo "unknown option: $MODE" >&2; exit 2 ;;
esac

LEGACY_ERE="$(IFS='|'; echo "${LEGACY_PATTERNS[*]}")"

is_new_rule_file() {
    local f
    for f in "${NEW_RULE_FILES[@]}"; do [[ "$1" == "$f" ]] && return 0; done
    return 1
}

grep_paths() {                   # $1 = ERE, rest = paths (missing ones skipped)
    local ere="$1"; shift
    local -a existing=()
    local p
    for p in "$@"; do [[ -e "$p" ]] && existing+=("$p"); done
    (( ${#existing[@]} )) || return 0
    grep -rniE --binary-files=without-match "$ere" "${existing[@]}" 2>/dev/null \
        | grep -vE '/node_modules/|/dist/|/build/|/htmlcov/|/coverage/' || true
}

is_ignored() {
    local g
    for g in "${IGNORE_GLOBS[@]}"; do [[ "$1" == $g ]] && return 0; done
    return 1
}

filter_hits() {                  # drop the methodology's own files, ignored paths, dated lines
    local line path
    while IFS= read -r line; do
        path="${line%%:*}"; path="${path#./}"
        is_new_rule_file "$path" && continue
        is_ignored "$path" && continue
        [[ "$line" =~ $DATED_LINE ]] && continue
        [[ "$line" =~ $CONTINUATION_LINE ]] && continue
        printf '%s\n' "$line"
    done
}

source_files() {
    local root ext
    local -a name_args=()
    for ext in "${SOURCE_EXTENSIONS[@]}"; do
        (( ${#name_args[@]} )) && name_args+=(-o)
        name_args+=(-name "*.${ext}")
    done
    for root in "${SOURCE_ROOTS[@]}"; do
        [[ -d "$root" ]] || continue
        find "$root" -type f \( "${name_args[@]}" \) \
            ! -path '*/node_modules/*' ! -path '*/dist/*' ! -path '*/build/*' -print
    done
}

section() { printf '\n== %s ==\n' "$1"; }
print_hits() { if [[ -n "$1" ]]; then printf '%s\n' "$1" | cut -c1-160; else echo "  (none)"; fi; }

RULE_HITS="$(grep_paths "$LEGACY_ERE" "${RULE_SURFACES[@]}" | filter_hits)"
SOURCE_HITS="$(source_files | xargs -r grep -niE --binary-files=without-match "$LEGACY_ERE" 2>/dev/null \
    | filter_hits || true)"
MIRROR_HITS="$(grep_paths "$LEGACY_ERE" "${GENERATED_MIRRORS[@]}" | filter_hits)"
INFO_HITS="$(grep_paths "$INFO_PATTERNS" \
    package.json .eslintrc .eslintrc.json .eslintrc.cjs eslint.config.js eslint.config.mjs \
    .prettierrc .prettierrc.json .editorconfig pyproject.toml ruff.toml setup.cfg .flake8 tox.ini \
    frontend/package.json frontend/eslint.config.js frontend/.prettierrc backend/pyproject.toml backend/ruff.toml)"

echo "=== Legacy file-size rule wording: $MODE ==="
section "RULE SURFACES (must be empty after adoption)";   print_hits "$RULE_HITS"
section "SOURCE COMMENTS (reword to cite the code-size rules)"; print_hits "$SOURCE_HITS"
section "GENERATED MIRRORS (regenerate; do not hand-edit)"; print_hits "$MIRROR_HITS"
section "LINTER SETTINGS (informational: what tooling enforces today)"; print_hits "$INFO_HITS"
if [[ "$MODE" == "--history" ]]; then
    section "DATED HISTORY (leave as written)"
    print_hits "$(grep_paths "$LEGACY_ERE" "${HISTORY_PATHS[@]}")"
fi
echo

if [[ "$MODE" == "--verify" ]]; then
    if [[ -n "$RULE_HITS" || -n "$SOURCE_HITS" ]]; then
        echo "RESULT: FAIL - legacy wording remains on a rule surface or in source."
        exit 1
    fi
    echo "RESULT: PASS - no legacy file-size wording on rule surfaces or in source."
fi
