#!/usr/bin/env node
// Usage: node add-plan.js "<title>" [options]
//   Adds a new design section to PLAN.md at the TOP of the sections (just under
//   the intro blockquote, above the current newest section). Heading format:
//   `## <title> (#<num>)`, matching the existing task sections.
//
//   --num <NNN>       issue/task number for the heading (default: highest (#NNN)
//                     already in PLAN.md, + 1). Pass the matching add-task number.
//   --why "<text>"    **Why.** paragraph
//   --scope "<text>"  **Scope.** paragraph
//   --guard "<text>"  **Guard.** paragraph
//   --section "Label: text"  extra bold-label paragraph; repeatable, kept in order
//   --body "<text>"   freeform body used verbatim instead of the labelled paragraphs
//   --plan <path>     path to PLAN.md (default: ./PLAN.md)
//
//   Any paragraph text may contain \n for line breaks. Prints the created heading.

const fs   = require('fs');
const path = require('path');

// --- Parse args ---
const argv = process.argv.slice(2);
let title = null;
const opts = { num: null, why: null, scope: null, guard: null, body: null, sections: [], plan: 'PLAN.md' };

for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  switch (a) {
    case '--num':     opts.num   = argv[++i]; break;
    case '--why':     opts.why   = argv[++i]; break;
    case '--scope':   opts.scope = argv[++i]; break;
    case '--guard':   opts.guard = argv[++i]; break;
    case '--body':    opts.body  = argv[++i]; break;
    case '--section': opts.sections.push(argv[++i]); break;
    case '--plan':    opts.plan  = argv[++i]; break;
    default:
      if (a.startsWith('--')) { process.stderr.write(`Unknown option "${a}"\n`); process.exit(1); }
      if (title === null) title = a;
      else { process.stderr.write(`Unexpected argument "${a}" (title already set)\n`); process.exit(1); }
  }
}

if (!title) {
  process.stderr.write('Usage: node add-plan.js "<title>" [--num N] [--why ...] [--scope ...] [--guard ...] [--section "Label: text"] [--body ...] [--plan path]\n');
  process.exit(1);
}

const resolved = path.resolve(opts.plan);
if (!fs.existsSync(resolved)) {
  process.stderr.write(`File not found: ${resolved}\n`);
  process.exit(1);
}
const lines = fs.readFileSync(resolved, 'utf8').split('\n');

// --- Determine number + insertion point (first level-2 heading) ---
let maxNum = 0;
let firstSectionIdx = -1;
lines.forEach((line, idx) => {
  if (/^## /.test(line) && !/^### /.test(line)) {
    if (firstSectionIdx === -1) firstSectionIdx = idx;
    const m = line.match(/\(#(\d+)\)/);
    if (m) maxNum = Math.max(maxNum, parseInt(m[1], 10));
  }
});

let num;
if (opts.num !== null) {
  if (!/^\d+$/.test(opts.num)) { process.stderr.write(`--num must be a number, got "${opts.num}"\n`); process.exit(1); }
  num = parseInt(opts.num, 10);
  if (lines.some(l => new RegExp(`^## .*\\(#${num}\\)`).test(l))) {
    process.stderr.write(`Plan section (#${num}) already exists in ${opts.plan}\n`);
    process.exit(1);
  }
} else {
  num = maxNum + 1;
}

// --- Build the section block ---
const block = [`## ${title} (#${num})`, ''];

function pushParagraph(text) {
  text.split('\n').forEach(l => block.push(l));
  block.push('');
}

if (opts.body) {
  pushParagraph(opts.body);
} else {
  if (opts.why)   pushParagraph(`**Why.** ${opts.why}`);
  if (opts.scope) pushParagraph(`**Scope.** ${opts.scope}`);
  for (const s of opts.sections) {
    const m = s.match(/^\s*([^:]+):\s*(.*)$/s);
    if (!m) { process.stderr.write(`--section must be "Label: text", got "${s}"\n`); process.exit(1); }
    const label = m[1].trim().replace(/\.$/, ''); // strip a trailing '.' so we don't double it
    pushParagraph(`**${label}.** ${m[2]}`);
  }
  if (opts.guard) pushParagraph(`**Guard.** ${opts.guard}`);
}

// --- Splice above the current top section ---
if (firstSectionIdx === -1) {
  while (lines.length && lines[lines.length - 1] === '') lines.pop();
  lines.push('', ...block);
} else {
  lines.splice(firstSectionIdx, 0, ...block);
}

fs.writeFileSync(resolved, lines.join('\n'), 'utf8');
process.stdout.write(`## ${title} (#${num})\n`);
