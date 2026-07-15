#!/usr/bin/env node
// Usage: node add-backlog.js "<text>" [--todo path]
//   Appends a plain description-text backlog item to TODO.md's `## Backlog` section —
//   a `- <text>` prose bullet, NOT a numbered `[ ]` task group. Use this for ideas /
//   deferred work that isn't ready to be a task (add-task.js is for those). The bullet
//   is placed after the existing backlog bullets, just above the first `### #NNN` group. If no
//   `## Backlog` heading exists yet, it is created (just under the H1 title, above any groups).
//
//   --todo <path>   path to TODO.md (default: ./TODO.md)
//
// Prints the created bullet on success.

const fs   = require('fs');
const path = require('path');

// --- Parse args ---
const argv = process.argv.slice(2);
let text = null;
const opts = { todo: 'TODO.md' };

for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  switch (a) {
    case '--todo': opts.todo = argv[++i]; break;
    default:
      if (a.startsWith('--')) { process.stderr.write(`Unknown option "${a}"\n`); process.exit(1); }
      if (text === null) text = a;
      else { process.stderr.write(`Unexpected argument "${a}" (text already set)\n`); process.exit(1); }
  }
}

if (!text || !text.trim()) {
  process.stderr.write('Usage: node add-backlog.js "<text>" [--todo path]\n');
  process.exit(1);
}

const resolved = path.resolve(opts.todo);
if (!fs.existsSync(resolved)) {
  process.stderr.write(`File not found: ${resolved}\n`);
  process.exit(1);
}
const lines = fs.readFileSync(resolved, 'utf8').split('\n');

// --- Locate the Backlog section and its prose region ---
// Bullet is a single physical line — newlines would break the list format, so flatten them.
const bullet = `- ${text.replace(/\s*\n\s*/g, ' ').trim()}`;

const backlogIdx = lines.findIndex(l => /^##\s+Backlog\b/.test(l));
if (backlogIdx === -1) {
  // No section yet: create `## Backlog` with this bullet. Prefer placing it just after the H1
  // title (so it sits above any task groups); else above the first group; else at the top.
  const section  = ['## Backlog', '', bullet, ''];
  const h1Idx    = lines.findIndex(l => /^# /.test(l));
  const groupIdx = lines.findIndex(l => /^### #\d+\b/.test(l));

  let at;
  if (h1Idx !== -1) {
    at = h1Idx + 1;
    if (lines[at] === '') at++;                  // keep the blank line under the title
    if (lines[at - 1] !== '') section.unshift(''); // ensure a blank separates title from section
  } else {
    at = groupIdx !== -1 ? groupIdx : 0;
  }
  lines.splice(at, 0, ...section);
  fs.writeFileSync(resolved, lines.join('\n'), 'utf8');
  process.stdout.write(`${bullet}\n`);
  process.exit(0);
}

// The prose region runs from just after the heading to the first numbered group (or EOF).
const firstGroupIdx = lines.findIndex((l, i) => i > backlogIdx && /^### #\d+\b/.test(l));
const regionEnd = firstGroupIdx === -1 ? lines.length : firstGroupIdx;

// Insert after the last existing prose bullet; if there are none yet, right after the heading.
let insertAt = -1;
for (let i = backlogIdx + 1; i < regionEnd; i++) {
  if (/^- /.test(lines[i])) insertAt = i + 1;
}
if (insertAt === -1) {
  insertAt = backlogIdx + 1;
  if (lines[insertAt] === '') insertAt++;               // keep the blank line under the heading
  lines.splice(insertAt, 0, bullet, '');                // seed the list + a trailing gap
} else {
  lines.splice(insertAt, 0, bullet);
}

fs.writeFileSync(resolved, lines.join('\n'), 'utf8');
process.stdout.write(`${bullet}\n`);
