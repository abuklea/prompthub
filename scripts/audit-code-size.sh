#!/usr/bin/env bash
# Project: PromptHub
# Author: Allan James
# Source: scripts/audit-code-size.sh
# MIME: text/x-shellscript
# Type: Bash script (bash 4+)
#
# Created: 19/10/2026 18:13 GMT+10
# Last modified: 19/10/2026 18:13 GMT+10
# ---------------
# The code-size audit and gate for this repository (docs/rules/code-size.md). Installed by the
# prp-project skill; the bands below are the methodology and are not tailored.
#
# Changelog:
# 19/10/2026 18:13 GMT+10 | Installed by the prp-project skill; tailor only the PROJECT CONFIGURATION block
#
# audit-code-size.sh - code-size audit against the agentability bands.
#
# Measures every source file's line count and estimated token footprint, bands it
# GREEN / YELLOW / RED, reports long lines as an advisory, and fails when a RED
# file has no recorded decision in the project's code-size register.
#
# Usage:
#   scripts/audit-code-size.sh              # full report
#   scripts/audit-code-size.sh --summary    # counts and result only
#   scripts/audit-code-size.sh --red        # every RED file, registered or not
#   scripts/audit-code-size.sh --long-lines # per-file long-line counts
#   scripts/audit-code-size.sh --docs       # always-on rule documents (lines + tokens)
#   scripts/audit-code-size.sh --json       # machine-readable per-file rows
#
# Exit status: 0 when every RED file is registered, 1 otherwise.
#
# The bands are the methodology and are the same in every project. The
# PROJECT CONFIGURATION block is the only part to tailor.

set -euo pipefail
export LC_ALL=C

# Run from the project root before any relative path or glob below is expanded.
SELF="$(cd "$(dirname "$0")" && pwd)/$(basename "$0")"
PROJECT_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$PROJECT_ROOT"

# ---------------------------------------------------------------------------
# PROJECT CONFIGURATION - tailor these for the project
# ---------------------------------------------------------------------------
# hand-written code; a root that does not exist is skipped
SCAN_ROOTS=(src app apps packages lib libs services cmd internal pkg tools scripts test tests)
# file types that count as source
EXTENSIONS=(ts tsx js jsx mjs cjs vue svelte py go rs cs java kt swift rb php css scss sh)
EXCLUDE_GLOBS=(                        # never measured: generated, vendored, tooling
    '*/node_modules/*' '*/dist/*' '*/build/*' '*/out/*' '*/target/*' '*/vendor/*'
    '*/.venv/*' '*/venv/*' '*/__pycache__/*' '*/.claude/*' '*/.gemini/*'
    '*/htmlcov/*' '*/coverage/*' '*/wip/*' '*/test-results/*' '*/playwright-report/*'
    '*.min.js' '*.min.css' '*/__generated__/*' '*/generated/*' '*.generated.*'
    '*/.wrangler/*' '*/public/*'                             # served verbatim, never bundled
)
TEST_GLOBS=(                           # banded the same way, reported separately
    '*/tests/*' '*/test/*' '*/__tests__/*' '*.test.*' '*.spec.*'
    '*/mocks/*' '*/__mocks__/*' '*/fixtures/*' '*/e2e/*'
)
REGISTER_FILE="docs/rules/code-size-register.md"
RULE_DOCS=(CLAUDE.md AGENTS.md GEMINI.md docs/rules/*.md .claude/AGENT-CONTRACT.md)

# Environment overrides let the skill's master copy run before a project copy
# is installed: AUDIT_SCAN_ROOTS="frontend/src backend" AUDIT_REGISTER=path
[[ -n "${AUDIT_SCAN_ROOTS:-}" ]] && read -ra SCAN_ROOTS <<< "$AUDIT_SCAN_ROOTS"
[[ -n "${AUDIT_REGISTER:-}" ]] && REGISTER_FILE="$AUDIT_REGISTER"

# ---------------------------------------------------------------------------
# THE BANDS - the methodology; do not tailor
# ---------------------------------------------------------------------------
GREEN_LINES=300;  GREEN_TOKENS=4000
YELLOW_LINES=600; YELLOW_TOKENS=8000
LINE_WARN=140;    LINE_AVOID=160
TOKEN_BYTES=4                          # estimate: one token per four bytes

# ---------------------------------------------------------------------------
MODE="${1:-full}"
usage() { sed -n '/^# audit-code-size.sh - /,/^# Exit status/p' "$SELF"; }

case "$MODE" in
    full|--summary|--red|--long-lines|--docs|--json) ;;
    -h|--help) usage; exit 0 ;;
    *) echo "unknown option: $MODE" >&2; usage >&2; exit 2 ;;
esac

# --- register: paths that carry a recorded decision ---------------------------
declare -A REGISTERED=()
declare -A REGISTERED_LINES=()
load_register() {
    [[ -f "$REGISTER_FILE" ]] || return 0
    local line
    while IFS= read -r line; do
        # a table row whose first cell is a number and second cell a backticked path
        if [[ "$line" =~ ^\|[[:space:]]*([0-9]+)[[:space:]]*\|[[:space:]]*\`([^\`]+)\` ]]; then
            REGISTERED["${BASH_REMATCH[2]}"]=1
            REGISTERED_LINES["${BASH_REMATCH[2]}"]="${BASH_REMATCH[1]}"
        fi
    done < "$REGISTER_FILE"
}

# --- file discovery -------------------------------------------------------------
matches_glob_list() {           # $1 = path, rest = globs
    local path="$1"; shift
    local glob
    for glob in "$@"; do [[ "$path" == $glob ]] && return 0; done
    return 1
}

list_source_files() {
    local root ext
    local -a name_args=()
    for ext in "${EXTENSIONS[@]}"; do
        (( ${#name_args[@]} )) && name_args+=(-o)
        name_args+=(-name "*.${ext}")
    done
    for root in "${SCAN_ROOTS[@]}"; do
        [[ -d "$root" ]] || continue
        find "$root" -type f \( "${name_args[@]}" \) -print
    done
}

# --- measurement ----------------------------------------------------------------
# prints: lines bytes max_len over_warn over_avoid
measure() {
    awk -v warn="$LINE_WARN" -v avoid="$LINE_AVOID" '
        { n++; l = length($0); b += l + 1
          if (l > max) max = l
          if (l > warn) w++
          if (l > avoid) a++ }
        END { printf "%d %d %d %d %d\n", n, b, max, w, a }' "$1"
}

band_for() {                    # $1 = lines, $2 = tokens
    if (( $1 > YELLOW_LINES || $2 > YELLOW_TOKENS )); then echo RED
    elif (( $1 > GREEN_LINES || $2 > GREEN_TOKENS )); then echo YELLOW
    else echo GREEN; fi
}

# --- collect --------------------------------------------------------------------
declare -a ROWS=()              # "band|category|lines|tokens|max|warn|avoid|path"
declare -A COUNT=()             # COUNT[category:band]
declare -A RED_PATHS=()
LONG_FILES=0; LONG_WARN_TOTAL=0; LONG_AVOID_TOTAL=0
declare -a UNREGISTERED_RED=() REGISTERED_RED=() STALE_ROWS=()

collect_file() {                # $1 = path relative to the project root
    local rel="$1" category stats lines bytes max warn avoid tokens band
    matches_glob_list "$rel" "${EXCLUDE_GLOBS[@]}" && return 0
    category=source
    matches_glob_list "$rel" "${TEST_GLOBS[@]}" && category=test
    stats="$(measure "$rel")"
    read -r lines bytes max warn avoid <<< "$stats"
    tokens=$(( bytes / TOKEN_BYTES ))
    band="$(band_for "$lines" "$tokens")"
    COUNT["$category:$band"]=$(( ${COUNT["$category:$band"]:-0} + 1 ))
    ROWS+=("$band|$category|$lines|$tokens|$max|$warn|$avoid|$rel")
    (( avoid > 0 )) && LONG_FILES=$(( LONG_FILES + 1 ))
    LONG_WARN_TOTAL=$(( LONG_WARN_TOTAL + warn ))
    LONG_AVOID_TOTAL=$(( LONG_AVOID_TOTAL + avoid ))
    [[ "$band" == RED ]] || return 0
    RED_PATHS["$rel"]=1
    if [[ -n "${REGISTERED[$rel]:-}" ]]; then
        REGISTERED_RED+=("$lines|$tokens|${REGISTERED_LINES[$rel]}|$rel")
    else
        UNREGISTERED_RED+=("$lines|$tokens|$rel")
    fi
}

collect() {
    local file reg
    while IFS= read -r file; do
        collect_file "${file#./}"
    done < <(list_source_files)
    for reg in "${!REGISTERED[@]}"; do
        if [[ ! -f "$reg" ]]; then
            STALE_ROWS+=("missing|$reg")
        elif [[ -z "${RED_PATHS[$reg]:-}" ]]; then
            STALE_ROWS+=("no-longer-red|$reg")
        fi
    done
}

# --- output ---------------------------------------------------------------------
fmt_tokens() { printf "~%'d tok" "$1"; }

print_header() {
    echo "=== Code Size Audit ==="
    echo "Bands: GREEN <= ${GREEN_LINES} lines and <= ${GREEN_TOKENS} est. tokens |" \
         "YELLOW <= ${YELLOW_LINES} lines and <= ${YELLOW_TOKENS} | RED beyond either"
    echo "Token estimate: bytes / ${TOKEN_BYTES}. Long lines: warn > ${LINE_WARN}, avoid > ${LINE_AVOID} bytes."
    echo "Register: ${REGISTER_FILE}"
    echo
}

print_unregistered() {
    local lines tokens rel
    (( ${#UNREGISTERED_RED[@]} )) || return 0
    echo "RED WITHOUT A RECORDED DECISION (split it, or add a row to the register):"
    printf '%s\n' "${UNREGISTERED_RED[@]}" | sort -t'|' -k1,1rn | while IFS='|' read -r lines tokens rel; do
        printf '  FAIL  %5d lines  %-14s %s\n' "$lines" "$(fmt_tokens "$tokens")" "$rel"
    done
    echo
}

print_registered() {
    local lines tokens reglines rel drift
    (( ${#REGISTERED_RED[@]} )) || return 0
    echo "RED WITH A RECORDED DECISION (drift shown when the register's count is stale):"
    printf '%s\n' "${REGISTERED_RED[@]}" | sort -t'|' -k1,1rn | while IFS='|' read -r lines tokens reglines rel; do
        drift=""
        (( reglines != lines )) && drift="  (register says ${reglines})"
        printf '  WARN  %5d lines  %-14s %s%s\n' "$lines" "$(fmt_tokens "$tokens")" "$rel" "$drift"
    done
    echo
}

print_stale() {
    local why rel
    (( ${#STALE_ROWS[@]} )) || return 0
    echo "REGISTER ROWS TO REMOVE (file gone, or no longer RED):"
    printf '%s\n' "${STALE_ROWS[@]}" | sort | while IFS='|' read -r why rel; do
        printf '  STALE %-14s %s\n' "$why" "$rel"
    done
    echo
}

print_long_lines() {
    echo "LONG LINES (advisory; the gate does not fail on these):"
    printf '%s\n' "${ROWS[@]}" \
        | awk -F'|' -v avoid="$LINE_AVOID" -v warn="$LINE_WARN" \
            '$7 > 0 { printf "  %4d over %d  %4d over %d  %s\n", $7, avoid, $6, warn, $8 }' \
        | sort -rn
    echo
}

print_docs() {
    local doc lines bytes max warn avoid tokens band
    echo "ALWAYS-ON RULE DOCUMENTS (every session pays these tokens):"
    printf '  %-6s %6s  %-14s %s\n' BAND LINES "EST. TOKENS" FILE
    for doc in "${RULE_DOCS[@]}"; do
        [[ -f "$doc" ]] || continue
        read -r lines bytes max warn avoid <<< "$(measure "$doc")"
        tokens=$(( bytes / TOKEN_BYTES ))
        band="$(band_for "$lines" "$tokens")"
        printf '  %-6s %6d  %-14s %s\n' "$band" "$lines" "$(fmt_tokens "$tokens")" "$doc"
    done
    echo
}

print_json() {
    local first=1 band category lines tokens max warn avoid rel registered
    echo "["
    while IFS='|' read -r band category lines tokens max warn avoid rel; do
        registered=false; [[ -n "${REGISTERED[$rel]:-}" ]] && registered=true
        (( first )) && first=0 || echo ","
        printf '  {"path":"%s","category":"%s","band":"%s","lines":%d,"est_tokens":%d,' \
            "$rel" "$category" "$band" "$lines" "$tokens"
        printf '"max_line":%d,"over_%d":%d,"over_%d":%d,"registered":%s}' \
            "$max" "$LINE_WARN" "$warn" "$LINE_AVOID" "$avoid" "$registered"
    done < <(printf '%s\n' "${ROWS[@]}" | sort -t'|' -k8)
    echo; echo "]"
}

print_summary() {
    local c
    echo "Summary:"
    for c in source test; do
        printf '  %-7s GREEN %4d   YELLOW %4d   RED %4d\n' "$c" \
            "${COUNT[$c:GREEN]:-0}" "${COUNT[$c:YELLOW]:-0}" "${COUNT[$c:RED]:-0}"
    done
    printf '  RED with a decision: %d   RED without: %d   stale register rows: %d\n' \
        "${#REGISTERED_RED[@]}" "${#UNREGISTERED_RED[@]}" "${#STALE_ROWS[@]}"
    printf '  Long lines: %d files carry %d lines over %d (%d over %d); --long-lines lists them\n' \
        "$LONG_FILES" "$LONG_AVOID_TOTAL" "$LINE_AVOID" "$LONG_WARN_TOTAL" "$LINE_WARN"
    echo
    if (( ${#UNREGISTERED_RED[@]} )); then
        echo "RESULT: FAIL - ${#UNREGISTERED_RED[@]} RED file(s) have no recorded decision."
        echo "Action: split the file, or add a row with a decision to ${REGISTER_FILE}."
        return 1
    fi
    echo "RESULT: PASS - every RED file has a recorded decision."
}

main() {
    load_register
    collect
    case "$MODE" in
        --json)       print_json ;;
        --docs)       print_header; print_docs ;;
        --long-lines) print_header; print_long_lines ;;
        --red)        print_header; print_unregistered; print_registered; print_stale ;;
        --summary)    print_header; print_unregistered; print_summary ;;
        full)         print_header; print_unregistered; print_registered; print_stale
                      print_docs; print_summary ;;
    esac
}
main
