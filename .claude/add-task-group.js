#!/usr/bin/env node
// Usage: node add-task-group.js <number> <name> [todo-path]
//   number:    group number (e.g. 4)
//   name:      group name (e.g. "license-api phase 1")
//   todo-path: path to TODO.md (default: ./TODO.md)
//
// Inserts the new group directly below ## Backlog so newest work
// always appears at the top, above older completed groups.

const fs   = require('fs');
const path = require('path');

const [,, numberArg, ...rest] = process.argv;

let todoPath = 'TODO.md';
if (rest.length > 0 && rest[rest.length - 1].endsWith('.md')) {
  todoPath = rest.pop();
}
const name = rest.join(' ');

if (!numberArg || !name) {
  process.stderr.write('Usage: node add-task-group.js <number> <name> [todo-path]\n');
  process.exit(1);
}

const num = parseInt(numberArg, 10);
if (isNaN(num)) {
  process.stderr.write(`Group number must be an integer, got "${numberArg}"\n`);
  process.exit(1);
}

const now  = new Date();
const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
const header = `### #${num} ${name} — ${date}`;

const resolved = path.resolve(todoPath);
if (!fs.existsSync(resolved)) {
  process.stderr.write(`File not found: ${resolved}\n`);
  process.exit(1);
}

const lines      = fs.readFileSync(resolved, 'utf8').split('\n');
const backlogIdx = lines.findIndex(l => l.trim() === '## Backlog');

if (backlogIdx === -1) {
  process.stderr.write('Could not find "## Backlog" in TODO.md\n');
  process.exit(1);
}

// Find the first ### group that comes after ## Backlog
let insertAt = -1;
for (let i = backlogIdx + 1; i < lines.length; i++) {
  if (lines[i].startsWith('### ')) {
    insertAt = i;
    break;
  }
}

if (insertAt === -1) {
  // No existing groups — append after trimming trailing blank lines
  while (lines.length > 0 && lines[lines.length - 1].trim() === '') {
    lines.pop();
  }
  lines.push('', header, '');
} else {
  // Insert above the first existing group
  lines.splice(insertAt, 0, header, '');
}

fs.writeFileSync(resolved, lines.join('\n'), 'utf8');
process.stdout.write(`${header}\n`);
