#!/usr/bin/env node
// Usage: node add-item.js <group#> "<text>" [--todo path]
//   Appends a checklist item to the end of an EXISTING task group's item list.
//   The new item is `- [ ] <group#>.<next> <text>`, where <next> is one past the
//   highest existing <group#>.k sub-number in that group. Pending ([ ]) so the
//   plan-before-code hook still sees an open task.
//
//   Use this for a follow-up item on a group that already exists — add-task.js
//   always creates a NEW group, so it cannot do this.
//
//   --todo <path>   path to TODO.md (default: ./TODO.md)
//
// Prints the created item line on success. Errors if the group does not exist.

const fs   = require('fs');
const path = require('path');

// --- Parse args ---
const argv = process.argv.slice(2);
let group = null;
let text  = null;
let todo  = 'TODO.md';

for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  switch (a) {
    case '--todo': todo = argv[++i]; break;
    default:
      if (a.startsWith('--')) { process.stderr.write(`Unknown option "${a}"\n`); process.exit(1); }
      if (group === null) group = a;
      else if (text === null) text = a;
      else { process.stderr.write(`Unexpected argument "${a}"\n`); process.exit(1); }
  }
}

if (group === null || !/^\d+$/.test(group) || text === null || text.trim() === '') {
  process.stderr.write('Usage: node add-item.js <group#> "<text>" [--todo path]\n');
  process.exit(1);
}

const resolved = path.resolve(todo);
if (!fs.existsSync(resolved)) {
  process.stderr.write(`File not found: ${resolved}\n`);
  process.exit(1);
}
const lines = fs.readFileSync(resolved, 'utf8').split('\n');

// --- Locate the group block: from its header to the next ### / ## heading ---
const headerRe = new RegExp(`^### #${group}\\b`);
const startIdx = lines.findIndex(l => headerRe.test(l));
if (startIdx === -1) {
  process.stderr.write(`Task group #${group} not found in ${todo}\n`);
  process.exit(1);
}

let endIdx = lines.length;
for (let i = startIdx + 1; i < lines.length; i++) {
  if (/^### /.test(lines[i]) || (/^## /.test(lines[i]) && !/^### /.test(lines[i]))) {
    endIdx = i;
    break;
  }
}

// --- Next sub-number: one past the highest <group#>.k in this group ---
let maxSub = 0;
let lastItemIdx = -1;
const subRe = new RegExp(`^- \\[[ ~x-]\\]\\s+${group}\\.(\\d+)\\b`);
for (let i = startIdx + 1; i < endIdx; i++) {
  if (/^- \[[ ~x-]\]/.test(lines[i])) lastItemIdx = i;
  const m = lines[i].match(subRe);
  if (m) maxSub = Math.max(maxSub, parseInt(m[1], 10));
}
const next = maxSub + 1;

const newLine = `- [ ] ${group}.${next} ${text}`;

// --- Splice after the last item; if the group has none, before trailing blanks ---
let insertAt;
if (lastItemIdx !== -1) {
  insertAt = lastItemIdx + 1;
} else {
  insertAt = endIdx;
  while (insertAt > startIdx + 1 && lines[insertAt - 1] === '') insertAt--;
}
lines.splice(insertAt, 0, newLine);

fs.writeFileSync(resolved, lines.join('\n'), 'utf8');
process.stdout.write(`${newLine.replace(/^- /, '').trim()}\n`);
