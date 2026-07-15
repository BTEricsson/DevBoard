#!/usr/bin/env node
// Usage: node list-tasks.js [todo-path] [--limit N]
//   todo-path: path to TODO.md (default: ./TODO.md)
//   --limit N: number of recent task groups to show (default: 5)
// Task IDs (e.g. "32.1") shown in output can be passed directly as patterns to set-task.js.

const fs   = require('fs');
const path = require('path');

let todoPath = 'TODO.md';
let limit    = 5;

for (let i = 2; i < process.argv.length; i++) {
  if (process.argv[i] === '--limit') {
    limit = parseInt(process.argv[++i], 10);
  } else {
    todoPath = process.argv[i];
  }
}

const resolved = path.resolve(todoPath);
if (!fs.existsSync(resolved)) {
  process.stderr.write(`File not found: ${resolved}\n`);
  process.exit(1);
}

const lines = fs.readFileSync(resolved, 'utf8').split('\n');

// --- Parse ---
const backlog = [];
const groups  = [];

let inBacklog    = false;
let currentGroup = null;

for (const line of lines) {
  if (/^## Backlog/.test(line)) {
    inBacklog = true;
    continue;
  }

  if (/^### #/.test(line)) {
    inBacklog = false;
    if (currentGroup) groups.push(currentGroup);
    currentGroup = { header: line, tasks: [] };
    continue;
  }

  if (/^##/.test(line) && !/^###/.test(line)) {
    inBacklog = false;
  }

  if (inBacklog && /^- /.test(line) && !/^- \[/.test(line)) {
    backlog.push(line);
  }

  if (currentGroup && /^- \[/.test(line)) {
    currentGroup.tasks.push(line);
  }
}
if (currentGroup) groups.push(currentGroup);

// --- Status ---
function groupStatus(tasks) {
  if (tasks.some(t => /^- \[~\]/.test(t))) return 'active';
  if (tasks.some(t => /^- \[ \]/.test(t))) return 'open';
  return 'done';
}

// --- Output ---
if (backlog.length) {
  process.stdout.write('BACKLOG:\n');
  backlog.forEach(b => process.stdout.write(`${b}\n`));
  process.stdout.write('\n');
}

process.stdout.write(`GROUPS (last ${Math.min(limit, groups.length)}):\n`);
groups.slice(0, limit).forEach(g => {
  const status = groupStatus(g.tasks);
  const header = g.header.replace(/^### /, '').replace(/ — .*/, '');
  process.stdout.write(`${header} [${status}]\n`);

  if (status !== 'done') {
    // Only show remaining (open + active) tasks — done tasks within a group are noise
    g.tasks
      .filter(t => /^- \[[ ~]\]/.test(t))
      .forEach(t => {
        const text = t.replace(/^- /, '').trim(); // "[ ] 32.1 text"
        const short = text.length > 80 ? text.slice(0, 77) + '...' : text;
        process.stdout.write(`  ${short}\n`);
      });
  }

  process.stdout.write('\n');
});
