require('dotenv').config();
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const fs = require('fs');
const chokidar = require('chokidar');

const { scanProjects, readPlanTicket } = require('./scanner');
const { parseProject } = require('./parser');

const PORT = process.env.PORT || 3333;

if (!process.env.ROOT_DIR) {
  console.error('ERROR: ROOT_DIR is not set. Create a .env file with ROOT_DIR=/path/to/your/projects');
  process.exit(1);
}

// Resolve relative to this file's location and lock it down
const ROOT_DIR = path.resolve(__dirname, process.env.ROOT_DIR);

function deriveNick(input) {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) return trimmed.slice(0, 5).toUpperCase();
  // Full name: use first name, max 4 chars
  return parts[0].slice(0, 4).toUpperCase();
}

function nickFromMemory() {
  try {
    // Derive memory dir from project path: ~/.claude/projects/<path-with-dashes>/memory/
    const os = require('os');
    const projectKey = __dirname.replace(/[/\\]/g, '-');
    const memFile = path.join(os.homedir(), '.claude', 'projects', projectKey, 'memory', 'user_identity.md');
    if (!fs.existsSync(memFile)) return null;
    const content = fs.readFileSync(memFile, 'utf8');
    const match = content.match(/^Nick:\s*(\S+)/im);
    return match ? match[1].slice(0, 5).toUpperCase() : null;
  } catch (e) {
    return null;
  }
}

function resolveNick() {
  if (process.env.NICK) return process.env.NICK.slice(0, 5).toUpperCase();
  return nickFromMemory();
}

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// In-memory store keyed by project folder path
let projectStore = {};
let GLOBAL_NICK = null;

function buildProjectData(proj) {
  const parsed = parseProject(proj);
  return {
    id: proj.name,
    folderName: proj.name,
    path: proj.path,
    claudeMdPath: proj.claudeMdPath,
    todoMdPath: proj.todoMdPath || null,
    planTicket: proj.planTicket || null,
    ...parsed,
  };
}

function loadAll() {
  const found = scanProjects(ROOT_DIR);
  const store = {};
  for (const proj of found) {
    store[proj.path] = buildProjectData(proj);
    if (stampCompletedGroups(store[proj.path])) {
      store[proj.path] = buildProjectData(proj);
    }
  }
  projectStore = store;
}

// Given any changed file path, find the project it belongs to
function findProjectByFile(filePath) {
  const projectPath = path.dirname(filePath);
  return projectStore[projectPath] || null;
}

function rebuildProject(projectPath) {
  const claudeMdPath = path.join(projectPath, 'CLAUDE.md');
  if (!fs.existsSync(claudeMdPath)) return;
  const todoMdPath = path.join(projectPath, 'TODO.md');
  const folderName = path.basename(projectPath);
  const proj = {
    name: folderName,
    path: projectPath,
    claudeMdPath,
    todoMdPath: fs.existsSync(todoMdPath) ? todoMdPath : null,
    planTicket: readPlanTicket(path.join(projectPath, 'PLAN.md')),
  };
  projectStore[projectPath] = buildProjectData(proj);
  if (stampCompletedGroups(projectStore[projectPath])) {
    // Re-parse after stamping so the store reflects the timestamps
    projectStore[projectPath] = buildProjectData(proj);
  }
}

function broadcast(payload) {
  const msg = JSON.stringify(payload);
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(msg);
    }
  }
}

function broadcastAll() {
  broadcast({ type: 'update', projects: Object.values(projectStore) });
}

app.get('/api/projects', (req, res) => {
  res.json(Object.values(projectStore));
});

function stampCompletedGroups(proj) {
  if (!proj.todoMdPath) return false;
  const groups = proj.tasks.groups || [];
  const needsStamp = groups.filter(g => g.status === 'complete' && !g.completedAt);
  if (needsStamp.length === 0) return false;

  const resolved = path.resolve(proj.todoMdPath);
  const rel = path.relative(ROOT_DIR, resolved);
  if (rel.startsWith('..') || path.isAbsolute(rel)) return false;

  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  const datetime = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
  const stampSuffix = GLOBAL_NICK ? ` — ${datetime} ${GLOBAL_NICK}` : ` — ${datetime}`;

  const ticketsToStamp = new Set(needsStamp.map(g => g.ticket).filter(Boolean));
  const namesToStamp = new Set(needsStamp.filter(g => !g.ticket).map(g => g.name));

  const lines = fs.readFileSync(resolved, 'utf8').split('\n');
  const updated = lines.map(line => {
    if (!/^#{3}\s/.test(line)) return line;
    if (/\s+—\s+\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(line)) return line; // already stamped
    const raw = line.replace(/^#{3}\s+/, '').trim();
    const ticketMatch = raw.match(/^#(\d+)\s+/);
    const lineTicket = ticketMatch ? ticketMatch[1] : null;
    const lineName = raw.replace(/^#\d+\s+/, '').trim();
    if ((lineTicket && ticketsToStamp.has(lineTicket)) || (!lineTicket && namesToStamp.has(lineName))) {
      return `${line}${stampSuffix}`;
    }
    return line;
  });

  fs.writeFileSync(resolved, updated.join('\n'), 'utf8');
  console.log(`[✓] Stamped ${needsStamp.map(g => g.name).join(', ')} in ${path.basename(proj.todoMdPath)}`);
  return true;
}

wss.on('connection', (ws) => {
  ws.send(JSON.stringify({ type: 'update', projects: Object.values(projectStore) }));
});

function setupWatcher() {
  const watcher = chokidar.watch(ROOT_DIR, {
    depth: 2,
    ignoreInitial: true,
    ignored: /(^|[/\\])\../,
  });

  const WATCHED = new Set(['CLAUDE.md', 'TODO.md', 'PLAN.md']);

  watcher.on('add', (filePath) => {
    const base = path.basename(filePath);
    if (!WATCHED.has(base)) return;
    const projectPath = path.dirname(filePath);
    rebuildProject(projectPath);
    broadcastAll();
    console.log(`[+] File added: ${filePath}`);
  });

  watcher.on('change', (filePath) => {
    const base = path.basename(filePath);
    if (!WATCHED.has(base)) return;
    const projectPath = path.dirname(filePath);
    if (!projectStore[projectPath]) return;
    rebuildProject(projectPath);
    broadcastAll();
    console.log(`[~] Updated: ${path.basename(projectPath)} (${base})`);
  });

  watcher.on('unlink', (filePath) => {
    const base = path.basename(filePath);
    if (base === 'CLAUDE.md') {
      const projectPath = path.dirname(filePath);
      if (projectStore[projectPath]) {
        const name = projectStore[projectPath].folderName;
        delete projectStore[projectPath];
        broadcastAll();
        console.log(`[-] Project removed: ${name}`);
      }
    }
    if (base === 'TODO.md') {
      const projectPath = path.dirname(filePath);
      if (projectStore[projectPath]) {
        rebuildProject(projectPath);
        broadcastAll();
        console.log(`[~] TODO.md removed: ${path.basename(projectPath)}`);
      }
    }
    if (base === 'PLAN.md') {
      const projectPath = path.dirname(filePath);
      if (projectStore[projectPath]) {
        rebuildProject(projectPath);
        broadcastAll();
        console.log(`[~] PLAN.md removed: ${path.basename(projectPath)}`);
      }
    }
  });
}

GLOBAL_NICK = resolveNick();
loadAll();
setupWatcher();
server.listen(PORT, () => {
  console.log(`DevBoard running at http://localhost:${PORT}`);
  console.log(`Scanning: ${ROOT_DIR}`);
  console.log(`Found ${Object.keys(projectStore).length} project(s)`);
  if (GLOBAL_NICK) console.log(`Nick: ${GLOBAL_NICK}`);
});
