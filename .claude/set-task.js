#!/usr/bin/env node
// Usage: node set-task.js <state> <pattern> [todo-path]
//   state:     pending | active | done | dropped
//   pattern:   case-insensitive substring of the task line to match
//              use the task ID (e.g. "32.1") for a precise, unambiguous match
//   todo-path: path to TODO.md (default: ./TODO.md)
//
// NOTE: this file is kept in sync across all repos that use TODO.md tracking.
// The `dropped`/[-] state was added in devBoard (group #36) — propagate this
// change to the other copies when syncing.

const fs   = require('fs');
const path = require('path');

const STATE_MAP = {
  pending: '[ ]',
  active:  '[~]',
  done:    '[x]',
  dropped: '[-]',
  '[ ]':   '[ ]',
  '[~]':   '[~]',
  '[x]':   '[x]',
  '[-]':   '[-]',
};

const [,, stateArg, pattern, todoPath = 'TODO.md'] = process.argv;

if (!stateArg || !pattern) {
  process.stderr.write('Usage: node set-task.js <state> <pattern> [todo-path]\n');
  process.stderr.write('  state: pending | active | done | dropped\n');
  process.exit(1);
}

const newState = STATE_MAP[stateArg];
if (!newState) {
  process.stderr.write(`Unknown state "${stateArg}". Use: pending, active, done, dropped\n`);
  process.exit(1);
}

// Match any task not already in the target state.
// For `active` and `done`, exclude [x] tasks so the archived history
// doesn't pollute results — completed tasks are never re-targeted.
const SOURCE_STATES = {
  '[ ]': /^- \[[~x-]\]/,  // pending ← from active, done or dropped
  '[~]': /^- \[ \]/,      // active  ← from pending only (never re-activate [x]/[-])
  '[x]': /^- \[[ ~]\]/,   // done    ← from pending or active
  '[-]': /^- \[[ ~x]\]/,  // dropped ← from pending, active or done
};
const sourcePattern = SOURCE_STATES[newState];

const resolved = path.resolve(todoPath);
const lines    = fs.readFileSync(resolved, 'utf8').split('\n');
const lower    = pattern.toLowerCase();

let matched = 0;
let matchedLine = '';
const updated = lines.map(line => {
  if (sourcePattern.test(line) && line.toLowerCase().includes(lower)) {
    matched++;
    const newLine = line.replace(/^(- )\[[ ~x-]\]/, `$1${newState}`);
    matchedLine = newLine;
    return newLine;
  }
  return line;
});

if (matched === 0) {
  process.stderr.write(`No task matched "${pattern}"\n`);
  process.exit(1);
}
if (matched > 1) {
  process.stderr.write(`Ambiguous: ${matched} tasks matched "${pattern}". Use a more specific pattern.\n`);
  process.exit(1);
}

fs.writeFileSync(resolved, updated.join('\n'), 'utf8');
process.stdout.write(`${matchedLine.replace(/^- /, '').trim()}\n`);
