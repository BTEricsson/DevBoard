#!/usr/bin/env node
// Usage: node add-task.js "<title>" [options]
//   Adds a new task group to TODO.md at the TOP of the groups list (just under
//   ## Backlog, above the current highest-numbered group). The group number is
//   auto-assigned as (highest existing #NNN) + 1 unless --num is given. New tasks
//   are created pending ([ ]) so the plan-before-code hook sees an open task.
//
//   --desc "<text>"     description paragraph under the header (\n for line breaks)
//   --task "<text>"     a checklist item; repeatable. Numbered NNN.1, NNN.2, …
//                       If none given, one item is generated from the title.
//   --plan-ref "<t>"    appends `See PLAN.md "<t>".` to the description
//   --num <NNN>         force the group number instead of auto-incrementing
//   --date <YYYY-MM-DD> header date (default: today, local time)
//   --todo <path>       path to TODO.md (default: ./TODO.md)
//
// Prints the created group's header line on success.

const fs   = require('fs');
const path = require('path');

// --- Parse args ---
const argv = process.argv.slice(2);
let title = null;
const opts = { desc: null, tasks: [], planRef: null, num: null, date: null, todo: 'TODO.md' };

for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  switch (a) {
    case '--desc':     opts.desc    = argv[++i]; break;
    case '--task':     opts.tasks.push(argv[++i]); break;
    case '--plan-ref': opts.planRef = argv[++i]; break;
    case '--num':      opts.num     = argv[++i]; break;
    case '--date':     opts.date    = argv[++i]; break;
    case '--todo':     opts.todo    = argv[++i]; break;
    default:
      if (a.startsWith('--')) { process.stderr.write(`Unknown option "${a}"\n`); process.exit(1); }
      if (title === null) title = a;
      else { process.stderr.write(`Unexpected argument "${a}" (title already set)\n`); process.exit(1); }
  }
}

if (!title) {
  process.stderr.write('Usage: node add-task.js "<title>" [--desc ...] [--task ...] [--plan-ref ...] [--num N] [--date YYYY-MM-DD] [--todo path]\n');
  process.exit(1);
}

const resolved = path.resolve(opts.todo);
if (!fs.existsSync(resolved)) {
  process.stderr.write(`File not found: ${resolved}\n`);
  process.exit(1);
}
const lines = fs.readFileSync(resolved, 'utf8').split('\n');

// --- Determine the group number ---
let maxNum = 0;
let firstGroupIdx = -1;
lines.forEach((line, idx) => {
  const m = line.match(/^### #(\d+)\b/);
  if (m) {
    if (firstGroupIdx === -1) firstGroupIdx = idx;
    maxNum = Math.max(maxNum, parseInt(m[1], 10));
  }
});

let num;
if (opts.num !== null) {
  if (!/^\d+$/.test(opts.num)) { process.stderr.write(`--num must be a number, got "${opts.num}"\n`); process.exit(1); }
  num = parseInt(opts.num, 10);
  if (lines.some(l => new RegExp(`^### #${num}\\b`).test(l))) {
    process.stderr.write(`Task #${num} already exists in ${opts.todo}\n`);
    process.exit(1);
  }
} else {
  num = maxNum + 1;
}

const date = opts.date || new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD, local

// --- Build the group block ---
let desc = opts.desc || '';
if (opts.planRef) {
  const ref = `See PLAN.md "${opts.planRef}".`;
  desc = desc ? `${desc.replace(/\s*$/, '')} ${ref}` : ref;
}

const tasks = opts.tasks.length ? opts.tasks : [title];

const block = [`### #${num} ${title} — ${date}`, ''];
if (desc) {
  desc.split('\n').forEach(l => block.push(l));
  block.push('');
}
tasks.forEach((t, i) => block.push(`- [ ] ${num}.${i + 1} ${t}`));

// --- Splice it in above the current top group ---
if (firstGroupIdx === -1) {
  // No groups yet: append at end, after a blank-line gap.
  while (lines.length && lines[lines.length - 1] === '') lines.pop();
  lines.push('', '', ...block, '');
} else {
  lines.splice(firstGroupIdx, 0, ...block, '');
}

fs.writeFileSync(resolved, lines.join('\n'), 'utf8');
process.stdout.write(`### #${num} ${title} — ${date}\n`);
