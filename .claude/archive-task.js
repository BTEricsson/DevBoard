#!/usr/bin/env node
// Usage: node archive-task.js <num> [<num>...] [options]
//        node archive-task.js --before <N> [options]
//   Moves completed task groups out of the living TODO.md / PLAN.md into the
//   archive files, preserving each archive's ordering (TODO newest-first, PLAN
//   oldest-first) and updating the intro-range / footer sentences.
//
//   A group is only moved if every checklist item is done ([x]) — a group with
//   an open ([ ]) or active ([~]) item aborts the whole run (nothing is written).
//   The matching PLAN.md section (## … (#N)) is moved too when its primary #N
//   equals the task number; combined sections (e.g. (#102–#104)) move once, with
//   their primary number.
//
//   --before N          archive every fully-done group with number < N
//   --dry-run           report what would move; write nothing
//   --todo path         living TODO.md          (default: ./TODO.md)
//   --plan path         living PLAN.md          (default: ./PLAN.md)
//   --todo-archive p    (default: ./docs/archive/TODO-archive.md)
//   --plan-archive p    (default: ./docs/archive/PLAN-archive.md)

const fs   = require('fs');
const path = require('path');

// ---------- args ----------
const opts = {
  nums: [], before: null, dryRun: false,
  todo: 'TODO.md', plan: 'PLAN.md',
  todoArchive: 'docs/archive/TODO-archive.md',
  planArchive: 'docs/archive/PLAN-archive.md',
};
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  switch (a) {
    case '--before':       opts.before      = parseInt(argv[++i], 10); break;
    case '--dry-run':      opts.dryRun      = true; break;
    case '--todo':         opts.todo        = argv[++i]; break;
    case '--plan':         opts.plan        = argv[++i]; break;
    case '--todo-archive': opts.todoArchive = argv[++i]; break;
    case '--plan-archive': opts.planArchive = argv[++i]; break;
    default:
      if (/^\d+$/.test(a)) opts.nums.push(parseInt(a, 10));
      else { process.stderr.write(`Unknown argument "${a}"\n`); process.exit(1); }
  }
}

const die = m => { process.stderr.write(m + '\n'); process.exit(1); };
const read = p => {
  const r = path.resolve(p);
  if (!fs.existsSync(r)) die(`File not found: ${r}`);
  return fs.readFileSync(r, 'utf8');
};

// ---------- parsing helpers ----------
// Split text into { preamble, sections:[{num,text}], footer } where sections
// start at `headerRe`. `footerRe` (optional) peels a trailing block to keep.
function parse(text, headerRe, footerRe) {
  let footer = '';
  if (footerRe) {
    const fm = text.match(footerRe);
    if (fm) { footer = text.slice(fm.index).trim(); text = text.slice(0, fm.index); }
  }
  const lines = text.split('\n');
  const idxs = [];
  let fence = false;
  lines.forEach((ln, i) => {
    if (ln.trimStart().startsWith('```')) { fence = !fence; return; }
    if (!fence && headerRe.test(ln)) idxs.push(i);
  });
  const preamble = idxs.length ? lines.slice(0, idxs[0]).join('\n') : text;
  const sections = [];
  idxs.forEach((s, k) => {
    const end = k + 1 < idxs.length ? idxs[k + 1] : lines.length;
    const block = lines.slice(s, end).join('\n');
    const m = lines[s].match(/#(\d+)/);
    sections.push({ num: m ? parseInt(m[1], 10) : null, text: block.trim() });
  });
  return { preamble: preamble.trim(), sections, footer };
}

function rebuild({ preamble, sections, footer }) {
  const body = sections.map(s => s.text.trim()).filter(Boolean);
  return [preamble, ...body, footer].filter(Boolean).join('\n\n') + '\n';
}

// insert into an already-ordered section list without reordering the rest
function insertSorted(sections, sec, descending) {
  const idx = sections.findIndex(s =>
    descending ? s.num !== null && s.num < sec.num
               : s.num !== null && s.num > sec.num);
  if (idx === -1) sections.push(sec); else sections.splice(idx, 0, sec);
}

function subst(text, re, replacement, label) {
  if (!re.test(text)) { process.stderr.write(`  warn: could not update ${label}\n`); return text; }
  return text.replace(re, replacement);
}

// ---------- load ----------
const TODO_HDR = /^### #\d+\b/;
const PLAN_HDR = /^## .*\(#\d+/;
const todo    = parse(read(opts.todo),        TODO_HDR, /\n## Archived/);
const todoArc = parse(read(opts.todoArchive), TODO_HDR);
const planRaw = read(opts.plan);
const plan    = parse(planRaw, /^## /, null); // all level-2 sections (foundational + numbered)
const planArc = parse(read(opts.planArchive), /^## /, null);

// ---------- resolve which task numbers to move ----------
function isDone(text) {
  const items = text.split('\n').filter(l => /^- \[[ x~-]\]/.test(l));
  return items.length > 0 && !items.some(l => /^- \[[ ~]\]/.test(l));
}

let targets = opts.nums.slice();
if (opts.before !== null) {
  for (const s of todo.sections) if (s.num < opts.before && isDone(s.text)) targets.push(s.num);
}
targets = [...new Set(targets)].sort((a, b) => a - b);
if (!targets.length) die('Nothing to archive. Pass task numbers or --before N.');

// validate every target before writing anything
const moveTodo = [];
for (const n of targets) {
  const sec = todo.sections.find(s => s.num === n);
  if (!sec) die(`Task #${n} not found among living TODO.md groups.`);
  if (!isDone(sec.text)) die(`Task #${n} is not fully done (has an open [ ] or active [~] item). Aborting.`);
  moveTodo.push(sec);
}
const targetSet = new Set(targets);
// numbered PLAN sections whose primary #N is being archived
const movePlan = plan.sections.filter(s => s.num !== null && targetSet.has(s.num));
const planMovedNums = new Set(movePlan.map(s => s.num));
const noPlanNote = targets.filter(n => !planMovedNums.has(n));

// ---------- dry run ----------
if (opts.dryRun) {
  process.stdout.write(`Would archive ${moveTodo.length} task group(s): ${targets.map(n => '#' + n).join(' ')}\n`);
  process.stdout.write(`  PLAN notes moved: ${movePlan.length ? [...planMovedNums].sort((a,b)=>a-b).map(n=>'#'+n).join(' ') : 'none'}\n`);
  if (noPlanNote.length) process.stdout.write(`  no PLAN note for: ${noPlanNote.map(n => '#' + n).join(' ')}\n`);
  process.exit(0);
}

// ---------- apply: TODO ----------
todo.sections    = todo.sections.filter(s => !targetSet.has(s.num));
for (const sec of moveTodo) insertSorted(todoArc.sections, sec, /*descending*/ true);

// ---------- apply: PLAN ----------
plan.sections    = plan.sections.filter(s => !(s.num !== null && targetSet.has(s.num)));
for (const sec of movePlan) insertSorted(planArc.sections, sec, /*descending*/ false);

// ---------- recompute ranges + intro/footer sentences ----------
const livingTodoNums = todo.sections.map(s => s.num).filter(n => n !== null);
const arcTodoNums    = todoArc.sections.map(s => s.num).filter(n => n !== null);
const minLivingTodo  = Math.min(...livingTodoNums);
const maxArcTodo     = Math.max(...arcTodoNums);

todoArc.preamble = subst(todoArc.preamble,
  /Tasks #\d+ and newer remain in `TODO\.md`/,
  `Tasks #${minLivingTodo} and newer remain in \`TODO.md\``, 'TODO-archive intro (remain)');
todoArc.preamble = subst(todoArc.preamble,
  /this file holds #\d+ down to #1/,
  `this file holds #${maxArcTodo} down to #1`, 'TODO-archive intro (holds)');
todo.footer = subst(todo.footer,
  /Completed task groups #\d+ and older have been moved/,
  `Completed task groups #${maxArcTodo} and older have been moved`, 'TODO.md footer');

const livingPlanNums = plan.sections.map(s => s.num).filter(n => n !== null);
const arcPlanNums    = planArc.sections.map(s => s.num).filter(n => n !== null);
if (livingPlanNums.length && arcPlanNums.length) {
  const minLivingPlan = Math.min(...livingPlanNums);
  const maxArcPlan    = Math.max(...arcPlanNums);
  planArc.preamble = subst(planArc.preamble,
    /completed tasks #65 through #\d+/,
    `completed tasks #65 through #${maxArcPlan}`, 'PLAN-archive intro (through)');
  planArc.preamble = subst(planArc.preamble,
    /Notes for #\d+ and newer remain in `PLAN\.md`/,
    `Notes for #${minLivingPlan} and newer remain in \`PLAN.md\``, 'PLAN-archive intro (remain)');
  // the living PLAN.md's own intro pointer (blockquote): "#65–#<max> … Notes for #<min> and"
  plan.preamble = subst(plan.preamble,
    /(completed tasks #65[–-]#)\d+/,
    `$1${maxArcPlan}`, 'PLAN.md intro (range)');
  plan.preamble = subst(plan.preamble,
    /(Notes for #)\d+( and)/,
    `$1${minLivingPlan}$2`, 'PLAN.md intro (remain)');
}

// ---------- write ----------
fs.writeFileSync(path.resolve(opts.todo),        rebuild(todo));
fs.writeFileSync(path.resolve(opts.todoArchive), rebuild(todoArc));
fs.writeFileSync(path.resolve(opts.plan),        rebuild(plan));
fs.writeFileSync(path.resolve(opts.planArchive), rebuild(planArc));

process.stdout.write(`Archived ${moveTodo.length} task group(s): ${targets.map(n => '#' + n).join(' ')}\n`);
process.stdout.write(`  PLAN notes moved: ${movePlan.length ? [...planMovedNums].sort((a,b)=>a-b).map(n=>'#'+n).join(' ') : 'none'}\n`);
if (noPlanNote.length) process.stdout.write(`  (no PLAN note for: ${noPlanNote.map(n => '#' + n).join(' ')})\n`);
