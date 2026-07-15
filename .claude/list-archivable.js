#!/usr/bin/env node
// Usage: node list-archivable.js [--todo path] [--plan path] [--before N]
//   Lists completed task groups in TODO.md that are safe to move to the archive
//   (every checklist item is [x] done — no [ ] open or [~] active items).
//   For each, shows the group number, title, and whether a matching PLAN.md
//   section (## … (#N)) exists. Feed the numbers to archive-task.js.
//
//   --before N   only list groups with number < N (older than #N)
//   --todo path  path to TODO.md (default: ./TODO.md)
//   --plan path  path to PLAN.md (default: ./PLAN.md)

const fs   = require('fs');
const path = require('path');

const opts = { todo: 'TODO.md', plan: 'PLAN.md', before: null };
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  switch (a) {
    case '--todo':   opts.todo   = argv[++i]; break;
    case '--plan':   opts.plan   = argv[++i]; break;
    case '--before': opts.before = parseInt(argv[++i], 10); break;
    default:
      process.stderr.write(`Unknown option "${a}"\n`);
      process.exit(1);
  }
}

const todoResolved = path.resolve(opts.todo);
if (!fs.existsSync(todoResolved)) {
  process.stderr.write(`File not found: ${todoResolved}\n`);
  process.exit(1);
}

// --- Parse TODO.md into task groups (stop at the ## Archived footer) ---
const lines  = fs.readFileSync(todoResolved, 'utf8').split('\n');
const groups = [];
let cur = null;
for (const line of lines) {
  const h = line.match(/^### #(\d+)\b(.*)$/);
  if (h) {
    if (cur) groups.push(cur);
    cur = { num: parseInt(h[1], 10), title: h[2].replace(/ — .*/, '').trim(), tasks: [] };
    continue;
  }
  if (/^## /.test(line)) { if (cur) { groups.push(cur); cur = null; } continue; } // e.g. ## Archived
  if (cur && /^- \[[ x~-]\]/.test(line)) cur.tasks.push(line);
}
if (cur) groups.push(cur);

// --- Which PLAN.md section numbers exist? (primary #N in "## … (#N…)") ---
const planNums = new Set();
if (fs.existsSync(path.resolve(opts.plan))) {
  const p = fs.readFileSync(path.resolve(opts.plan), 'utf8').split('\n');
  let fence = false;
  for (const line of p) {
    if (line.trimStart().startsWith('```')) { fence = !fence; continue; }
    if (!fence && /^## /.test(line)) {
      const m = line.match(/\(#(\d+)/);
      if (m) planNums.add(parseInt(m[1], 10));
    }
  }
}

function status(tasks) {
  if (!tasks.length)               return 'empty';
  if (tasks.some(t => /^- \[~\]/.test(t))) return 'active';
  if (tasks.some(t => /^- \[ \]/.test(t))) return 'open';
  return 'done';
}

const archivable = [];
const blocked    = [];
for (const g of groups) {
  if (opts.before !== null && g.num >= opts.before) continue;
  const st = status(g.tasks);
  if (st === 'done') archivable.push(g);
  else if (st === 'open' || st === 'active') blocked.push({ ...g, st });
}

archivable.sort((a, b) => a.num - b.num); // oldest first — natural archive order

if (!archivable.length) {
  process.stdout.write('ARCHIVABLE: none (no fully-done groups' +
    (opts.before !== null ? ` below #${opts.before})` : ')') + '\n');
} else {
  process.stdout.write(`ARCHIVABLE (done groups, oldest first): ${archivable.length}\n`);
  for (const g of archivable) {
    const title = g.title.length > 60 ? g.title.slice(0, 57) + '...' : g.title;
    process.stdout.write(`  #${g.num}  ${title}  [plan:${planNums.has(g.num) ? 'yes' : 'no'}]\n`);
  }
  const nums = archivable.map(g => g.num).join(' ');
  process.stdout.write(`\n  archive with: node .claude/archive-task.js ${nums}\n`);
}

if (blocked.length) {
  process.stdout.write(`\nNOT archivable (still open/active): ${blocked.length}\n`);
  for (const g of blocked) process.stdout.write(`  #${g.num}  [${g.st}]\n`);
}
