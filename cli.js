#!/usr/bin/env node
'use strict';

require('dotenv').config();
const path = require('path');
const readline = require('readline');
const chokidar = require('chokidar');
const { scanProjects } = require('./scanner');
const { parseProject } = require('./parser');

const ROOT_DIR = process.env.ROOT_DIR ? path.resolve(process.env.ROOT_DIR) : null;

// ─── Colors ──────────────────────────────────────────────────────────────────

const R = '\x1b[0m';
const c = {
  bold:     s => `\x1b[1m${s}${R}`,
  dim:      s => `\x1b[2m${s}${R}`,
  cyan:     s => `\x1b[36m${s}${R}`,
  cyanBold: s => `\x1b[1m\x1b[36m${s}${R}`,
  yellow:   s => `\x1b[33m${s}${R}`,
  green:    s => `\x1b[32m${s}${R}`,
  blue:     s => `\x1b[34m${s}${R}`,
  blueBold: s => `\x1b[1m\x1b[34m${s}${R}`,
  magenta:  s => `\x1b[35m${s}${R}`,
  red:      s => `\x1b[31m${s}${R}`,
};

// ─── State ───────────────────────────────────────────────────────────────────

const state = {
  mode: 'menu',   // 'menu' | 'board'
  cursor: 0,
  scroll: 0,
  projects: [],
  selected: null,
  showComplete: false,
};

// ─── Data ─────────────────────────────────────────────────────────────────────

function loadProjects() {
  if (!ROOT_DIR) return [];
  const raw = scanProjects(ROOT_DIR);
  const order = { active: 0, pending: 1, complete: 2 };
  return raw
    .map(p => ({ ...parseProject(p), id: p.name, path: p.path }))
    .sort((a, b) => (order[a.status] ?? 3) - (order[b.status] ?? 3));
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function cols() { return process.stdout.columns || 80; }
function rows() { return process.stdout.rows    || 24; }
function hr()   { return c.dim('─'.repeat(Math.min(cols() - 4, 60))); }

function statusDot(status) {
  if (status === 'active')   return c.blue('●');
  if (status === 'pending')  return c.yellow('○');
  if (status === 'complete') return c.green('✓');
  return c.dim('·');
}

function statusLabel(status) {
  if (status === 'active')   return c.blue(status);
  if (status === 'pending')  return c.yellow(status);
  if (status === 'complete') return c.dim(status);
  return c.dim(status);
}

// ─── Render: Menu ─────────────────────────────────────────────────────────────

function renderMenu() {
  const lines = ['', c.bold('  DevBoard'), `  ${hr()}`, ''];

  if (!ROOT_DIR) {
    lines.push(c.red('  ROOT_DIR not set in .env'), '');
  } else if (state.projects.length === 0) {
    lines.push(c.dim('  No projects found'), '');
  } else {
    for (let i = 0; i < state.projects.length; i++) {
      const p = state.projects[i];
      const sel = i === state.cursor;
      const arrow = sel ? c.cyan('›') : ' ';
      const name  = sel ? c.cyanBold(p.name) : p.name;
      const groups = p.tasks.groups || [];
      const nActive  = groups.filter(g => g.status === 'active').length;
      const nPending = groups.filter(g => g.status === 'pending').length;
      const hint = nActive  ? c.blue(`${nActive} active`)
                 : nPending ? c.yellow(`${nPending} pending`)
                 : '';
      const pad = ' '.repeat(Math.max(1, 30 - p.name.length));
      lines.push(`  ${arrow} ${statusDot(p.status)} ${name}${pad}${statusLabel(p.status)}  ${hint}`);
    }
    lines.push('');
  }

  lines.push(`  ${hr()}`);
  lines.push(c.dim('  ↑↓ navigate   enter open   n now   q quit'));
  return lines;
}

// ─── Render: Now ──────────────────────────────────────────────────────────────

function renderNow() {
  const lines = ['', c.bold('  Now'), `  ${hr()}`, ''];

  let found = false;
  for (const p of state.projects) {
    const active = (p.tasks.groups || []).filter(g => g.status === 'active');
    if (active.length === 0) continue;
    found = true;
    lines.push(`  ${c.cyanBold(p.name)}`);
    for (const g of active) {
      const label = g.ticket ? `#${g.ticket} ${g.name}` : g.name;
      lines.push(`    ${c.blue('●')} ${c.blueBold(label)}`);
      for (const t of (g.inProgress || [])) lines.push(`        ${c.blue('◑')} ${t}`);
      for (const t of (g.todo       || [])) lines.push(`        ${c.dim('○')} ${t}`);
    }
    lines.push('');
  }

  if (!found) lines.push(c.dim('  Nothing active right now'), '');

  lines.push(`  ${hr()}`);
  lines.push(c.dim('  b back   ↑↓ / jk scroll   q quit'));
  return lines;
}

// ─── Render: Board ────────────────────────────────────────────────────────────

function renderBoard() {
  const p = state.selected;
  if (!p) return [c.red('  No project selected')];

  const lines = ['', c.bold(`  ${p.name}`)];
  if (p.description) lines.push(c.dim(`  ${p.description}`));
  lines.push(`  ${hr()}`, '');

  const groups  = p.tasks.groups  || [];
  const backlog = p.tasks.backlog || [];
  const visible = [
    ...groups.filter(g => g.status === 'active'),
    ...groups.filter(g => g.status === 'pending'),
  ];
  const complete = groups.filter(g => g.status === 'complete');

  if (visible.length === 0 && backlog.length === 0) {
    lines.push(c.dim('  No active or pending groups'), '');
  }

  for (const g of visible) {
    const label = g.ticket ? `#${g.ticket} ${g.name}` : g.name;
    const heading = g.status === 'active' ? c.blueBold(label) : c.bold(label);
    lines.push(`  ${statusDot(g.status)} ${heading}`);
    for (const t of (g.inProgress || [])) lines.push(`      ${c.blue('◑')} ${t}`);
    for (const t of (g.todo       || [])) lines.push(`      ${c.dim('○')} ${t}`);
    for (const t of (g.done       || [])) lines.push(`      ${c.dim('✓')} ${c.dim(t)}`);
    lines.push('');
  }

  if (backlog.length > 0) {
    lines.push(`  ${c.magenta('· Backlog')}  ${c.dim(`(${backlog.length})`)}`);
    for (const t of backlog) lines.push(`      ${c.dim('· ' + t)}`);
    lines.push('');
  }

  if (complete.length > 0) {
    if (!state.showComplete) {
      lines.push(c.dim(`  ✓ ${complete.length} completed group${complete.length !== 1 ? 's' : ''}  (c to show)`), '');
    } else {
      lines.push(c.dim(`  ✓ Completed  (c to hide)`), '');
      for (const g of complete) {
        const label = g.ticket ? `#${g.ticket} ${g.name}` : g.name;
        const stamp = g.completedAt ? c.dim(`  ${g.completedAt}`) : '';
        lines.push(`  ${c.green('✓')} ${c.dim(label)}${stamp}`);
        for (const t of (g.done || [])) lines.push(`      ${c.dim('✓ ' + t)}`);
        lines.push('');
      }
    }
  }

  lines.push(`  ${hr()}`);
  lines.push(c.dim('  b back   ↑↓ / jk scroll   c complete   q quit'));
  return lines;
}

// ─── Render ───────────────────────────────────────────────────────────────────

function render() {
  const lines = state.mode === 'menu' ? renderMenu()
              : state.mode === 'now'  ? renderNow()
              : renderBoard();
  const h = rows() - 1;
  const visible = state.mode === 'board'
    ? lines.slice(state.scroll, state.scroll + h)
    : lines.slice(0, h);
  process.stdout.write('\x1b[2J\x1b[H');
  process.stdout.write(visible.join('\n') + '\n');
}

// ─── Input ────────────────────────────────────────────────────────────────────

function setupInput() {
  readline.emitKeypressEvents(process.stdin);
  if (process.stdin.isTTY) process.stdin.setRawMode(true);

  process.stdin.on('keypress', (_, key) => {
    if (!key) return;
    if (key.ctrl && key.name === 'c') process.exit(0);

    if (state.mode === 'menu') {
      if (key.name === 'up')     { state.cursor = Math.max(0, state.cursor - 1); render(); }
      if (key.name === 'down')   { state.cursor = Math.min(state.projects.length - 1, state.cursor + 1); render(); }
      if (key.name === 'return' && state.projects.length > 0) {
        state.selected = state.projects[state.cursor];
        state.scroll   = 0;
        state.mode     = 'board';
        render();
      }
      if (key.name === 'n') { state.mode = 'now'; state.scroll = 0; render(); }
      if (key.name === 'q') process.exit(0);
    } else if (state.mode === 'now') {
      if (key.name === 'up'   || key.name === 'k') { state.scroll = Math.max(0, state.scroll - 1); render(); }
      if (key.name === 'down' || key.name === 'j') { state.scroll++; render(); }
      if (key.name === 'b' || key.name === 'escape') { state.mode = 'menu'; state.scroll = 0; render(); }
      if (key.name === 'q') process.exit(0);
    } else {
      if (key.name === 'up'   || key.name === 'k') { state.scroll = Math.max(0, state.scroll - 1); render(); }
      if (key.name === 'down' || key.name === 'j') { state.scroll++; render(); }
      if (key.name === 'b' || key.name === 'escape') {
        state.mode         = 'menu';
        state.scroll       = 0;
        state.showComplete = false;
        render();
      }
      if (key.name === 'c') { state.showComplete = !state.showComplete; state.scroll = 0; render(); }
      if (key.name === 'q') process.exit(0);
    }
  });
}

// ─── Watcher ──────────────────────────────────────────────────────────────────

function setupWatcher() {
  if (!ROOT_DIR) return;
  chokidar.watch(ROOT_DIR, { depth: 2, ignoreInitial: true, ignored: /(^|[/\\])\.\./ }).on('all', () => {
    state.projects = loadProjects();
    if (state.selected) {
      const updated = state.projects.find(p => p.id === state.selected.id);
      if (updated) state.selected = updated;
    }
    render();
  });
}

// ─── Main ─────────────────────────────────────────────────────────────────────

state.projects = loadProjects();
setupInput();
setupWatcher();
render();
