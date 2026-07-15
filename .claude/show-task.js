#!/usr/bin/env node
// Usage: node show-task.js <num> [--plan] [--todo path] [--plan-path path]
//   Prints one task group from TODO.md in full — its `### #<num>` header, any
//   description paragraph(s), and EVERY checklist item ([ ]/[~]/[x]/[-]),
//   verbatim and untruncated. The read-side counterpart to list-tasks.js, which
//   deliberately summarizes.
//
//   --plan             also print the matching PLAN.md section (heading ends "(#<num>)")
//   --todo <path>      path to TODO.md (default: ./TODO.md)
//   --plan-path <path> path to PLAN.md (default: ./PLAN.md), only used with --plan
//
// Exits non-zero (with a stderr message) if the group is not found.

const fs   = require('fs');
const path = require('path');

// --- Parse args ---
const argv = process.argv.slice(2);
let num = null;
const opts = { plan: false, todo: 'TODO.md', planPath: 'PLAN.md' };

for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  switch (a) {
    case '--plan':      opts.plan     = true;      break;
    case '--todo':      opts.todo     = argv[++i]; break;
    case '--plan-path': opts.planPath = argv[++i]; break;
    default:
      if (a.startsWith('--')) { process.stderr.write(`Unknown option "${a}"\n`); process.exit(1); }
      if (num === null) num = a;
      else { process.stderr.write(`Unexpected argument "${a}" (num already set)\n`); process.exit(1); }
  }
}

if (num === null || !/^\d+$/.test(num)) {
  process.stderr.write('Usage: node show-task.js <num> [--plan] [--todo path] [--plan-path path]\n');
  process.exit(1);
}

const resolved = path.resolve(opts.todo);
if (!fs.existsSync(resolved)) {
  process.stderr.write(`File not found: ${resolved}\n`);
  process.exit(1);
}
const lines = fs.readFileSync(resolved, 'utf8').split('\n');

// --- Locate the group block: from its header to the next ### / ## heading ---
const headerRe = new RegExp(`^### #${num}\\b`);
const startIdx = lines.findIndex(l => headerRe.test(l));
if (startIdx === -1) {
  process.stderr.write(`Task group #${num} not found in ${opts.todo}\n`);
  process.exit(1);
}

let endIdx = lines.length;
for (let i = startIdx + 1; i < lines.length; i++) {
  if (/^### /.test(lines[i]) || (/^## /.test(lines[i]) && !/^### /.test(lines[i]))) {
    endIdx = i;
    break;
  }
}

// Trim trailing blank lines from the block.
const block = lines.slice(startIdx, endIdx);
while (block.length && block[block.length - 1] === '') block.pop();

process.stdout.write(block.join('\n') + '\n');

// --- Optionally append the matching PLAN.md section ---
if (opts.plan) {
  const planResolved = path.resolve(opts.planPath);
  if (!fs.existsSync(planResolved)) {
    process.stderr.write(`Plan file not found: ${planResolved}\n`);
    process.exit(0); // group printed fine; missing plan is not fatal
  }
  const planLines = fs.readFileSync(planResolved, 'utf8').split('\n');
  const secRe = new RegExp(`^## .*\\(#${num}\\)`);
  const pStart = planLines.findIndex(l => secRe.test(l));
  if (pStart === -1) process.exit(0); // no matching section — nothing to add

  let pEnd = planLines.length;
  for (let i = pStart + 1; i < planLines.length; i++) {
    if (/^## /.test(planLines[i]) && !/^### /.test(planLines[i])) { pEnd = i; break; }
  }
  const pBlock = planLines.slice(pStart, pEnd);
  while (pBlock.length && pBlock[pBlock.length - 1] === '') pBlock.pop();

  process.stdout.write('\n--- PLAN.md ---\n\n');
  process.stdout.write(pBlock.join('\n') + '\n');
}
