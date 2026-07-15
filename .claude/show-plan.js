#!/usr/bin/env node
// Usage: node show-plan.js <num> [--plan path]
//   Prints one section from PLAN.md — the block whose heading ends in "(#<num>)",
//   from that `## ` heading up to (but not including) the next `## ` heading.
//   The read-side mirror of add-plan.js.
//
//   --plan <path>   path to PLAN.md (default: ./PLAN.md)
//
// Exits non-zero (with a stderr message) if the section is not found.

const fs   = require('fs');
const path = require('path');

// --- Parse args ---
const argv = process.argv.slice(2);
let num  = null;
let plan = 'PLAN.md';

for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  switch (a) {
    case '--plan': plan = argv[++i]; break;
    default:
      if (a.startsWith('--')) { process.stderr.write(`Unknown option "${a}"\n`); process.exit(1); }
      if (num === null) num = a;
      else { process.stderr.write(`Unexpected argument "${a}" (num already set)\n`); process.exit(1); }
  }
}

if (num === null || !/^\d+$/.test(num)) {
  process.stderr.write('Usage: node show-plan.js <num> [--plan path]\n');
  process.exit(1);
}

const resolved = path.resolve(plan);
if (!fs.existsSync(resolved)) {
  process.stderr.write(`File not found: ${resolved}\n`);
  process.exit(1);
}
const lines = fs.readFileSync(resolved, 'utf8').split('\n');

// --- Locate the section: `## ... (#<num>)` up to the next `## ` heading ---
const headingRe = new RegExp(`^## .*\\(#${num}\\)`);
const startIdx = lines.findIndex(l => headingRe.test(l));
if (startIdx === -1) {
  process.stderr.write(`Plan section (#${num}) not found in ${plan}\n`);
  process.exit(1);
}

let endIdx = lines.length;
for (let i = startIdx + 1; i < lines.length; i++) {
  if (/^## /.test(lines[i]) && !/^### /.test(lines[i])) { endIdx = i; break; }
}

const block = lines.slice(startIdx, endIdx);
while (block.length && block[block.length - 1] === '') block.pop();

process.stdout.write(block.join('\n') + '\n');
