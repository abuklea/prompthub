#!/bin/bash

# Status line script for Claude Code
# Displays: 🧠 [model] | Ⓜ️ claude mode | 📁 cwd folder | 🌿 git branch | [context usage] | ver. version

# Read JSON input from stdin and store it for both parsing and passing to ccusage
input=$(cat)

# Extract data from JSON input
model_display_name=$(echo "$input" | jq -r '.model.display_name // "Unknown"')
current_dir=$(echo "$input" | jq -r '.workspace.current_dir // "unknown"')
version=$(echo "$input" | jq -r '.version // "unknown"')

# Get folder name (basename of current directory)
cwd_folder=$(basename "$current_dir" 2>/dev/null || echo "unknown")

# Get git branch (skip git locks for performance)
git_branch="unknown"
if [ -d "$current_dir/.git" ] 2>/dev/null; then
    if cd "$current_dir" 2>/dev/null; then
        branch_output=$(git branch --show-current 2>/dev/null | tr -d '\n' | head -c 20)
        if [ $? -eq 0 ] && [ -n "$branch_output" ]; then
            git_branch="$branch_output"
        fi
    fi
fi

# Get context usage from ccusage by passing the session JSON via stdin
context_usage="??%"
if command -v ccusage >/dev/null 2>&1; then
    # Pass the session JSON to ccusage via stdin with primary command
    usage_output=$(echo "$input" | ccusage statusline -B emoji --cost-source auto 2>/dev/null | head -1)
    if [ -n "$usage_output" ] && [ "$usage_output" != "" ] && [ "$usage_output" != "No input provided" ]; then
        context_usage="$usage_output"
    else
        # Fallback to simpler commands with session JSON
        usage_output=$(echo "$input" | ccusage statusline -B emoji 2>/dev/null | head -1)
        if [ -n "$usage_output" ] && [ "$usage_output" != "" ] && [ "$usage_output" != "No input provided" ]; then
            context_usage="$usage_output"
        else
            usage_output=$(echo "$input" | ccusage statusline 2>/dev/null | head -1)
            if [ -n "$usage_output" ] && [ "$usage_output" != "" ] && [ "$usage_output" != "No input provided" ]; then
                context_usage="$usage_output"
            fi
        fi
    fi
fi

# Format the status line with exact format requested
printf "📁 %s | 🌿 %s | %s | ver. %s" \
    "$cwd_folder" \
    "$git_branch" \
    "$context_usage" \
    "$version"