#!/bin/bash
# Block edits to code files if PLAN.md does not exist

file=$(jq -r '.tool_input.file_path // empty')
[ -z "$file" ] && exit 0

# Only check code files
echo "$file" | grep -qE '\.(php|js|html|css)$' || exit 0

# Skip exempt files
basename=$(basename "$file")
echo "$basename" | grep -qE '^(PLAN|TODO|CLAUDE|README)\.(md|MD)$' && exit 0
echo "$file" | grep -qE '(\.claude|memory)/' && exit 0

# Ask if PLAN.md is missing
REPO_ROOT="$(cd "$(dirname "$BASH_SOURCE[0]")/../.." && pwd)"
if [ ! -f "$REPO_ROOT/PLAN.md" ]; then
  echo "No PLAN.md found. Continue anyway? [y/N]" >&2
  read -r answer </dev/tty
  case "$answer" in
    [yY]*) exit 0 ;;
    *) echo '{"decision":"block","reason":"PLAN.md missing — create a plan before editing code."}' ;;
  esac
fi
