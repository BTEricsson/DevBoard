#!/usr/bin/env node
// PreToolUse (Edit|Write) hook: block edits to code files when PLAN.md is missing.
//
// Node port of the former check-plan.sh — no bash/jq/grep/tty dependency, so it
// runs on macOS, Linux and Windows unchanged. Reads the hook payload as JSON on
// stdin, and on a block writes {"decision":"block","reason":…} to stdout (exit 0).
// Allowing = exit 0 with no output. Fails open on any unexpected input.

const fs   = require('fs');
const path = require('path');

const CODE_EXT   = /\.(php|js|html|css)$/i;
const EXEMPT_DOC = /^(PLAN|TODO|CLAUDE|README)\.md$/i;
const EXEMPT_DIR = /[\\/](\.claude|memory)[\\/]/; // match on either separator (Windows too)

function allow() { process.exit(0); }
function block(reason) {
  process.stdout.write(JSON.stringify({ decision: 'block', reason }) + '\n');
  process.exit(0);
}

let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => { input += chunk; });
process.stdin.on('end', () => {
  let file = '';
  try {
    file = (JSON.parse(input || '{}').tool_input || {}).file_path || '';
  } catch {
    return allow(); // unparseable payload → don't get in the way
  }
  if (!file) return allow();

  // Only guard code files.
  if (!CODE_EXT.test(file)) return allow();

  // Skip exempt docs and anything under .claude/ or memory/.
  if (EXEMPT_DOC.test(path.basename(file))) return allow();
  if (EXEMPT_DIR.test(file)) return allow();

  // Repo root is two levels up from this hook file (.claude/hooks/ -> repo root).
  const repoRoot = path.resolve(__dirname, '..', '..');
  if (!fs.existsSync(path.join(repoRoot, 'PLAN.md'))) {
    return block('PLAN.md missing — create a plan before editing code.');
  }
  allow();
});
