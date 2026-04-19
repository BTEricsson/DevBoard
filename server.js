require('dotenv').config();
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const fs = require('fs');
const chokidar = require('chokidar');

const { scanProjects } = require('./scanner');
const { parseProject } = require('./parser');

const PORT = process.env.PORT || 3333;

if (!process.env.ROOT_DIR) {
  console.error('ERROR: ROOT_DIR is not set. Create a .env file with ROOT_DIR=/path/to/your/projects');
  process.exit(1);
}

// Resolve relative to this file's location and lock it down
const ROOT_DIR = path.resolve(__dirname, process.env.ROOT_DIR);

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(express.static(path.join(__dirname, 'public')));

// In-memory store keyed by project folder path
let projectStore = {};

function buildProjectData(proj) {
  const parsed = parseProject(proj);
  return {
    id: proj.name,
    folderName: proj.name,
    path: proj.path,
    claudeMdPath: proj.claudeMdPath,
    todoMdPath: proj.todoMdPath || null,
    ...parsed,
  };
}

function loadAll() {
  const found = scanProjects(ROOT_DIR);
  const store = {};
  for (const proj of found) {
    store[proj.path] = buildProjectData(proj);
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
  };
  projectStore[projectPath] = buildProjectData(proj);
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

wss.on('connection', (ws) => {
  ws.send(JSON.stringify({ type: 'update', projects: Object.values(projectStore) }));
});

function setupWatcher() {
  const watcher = chokidar.watch(ROOT_DIR, {
    depth: 2,
    ignoreInitial: true,
    ignored: /(^|[/\\])\../,
  });

  const WATCHED = new Set(['CLAUDE.md', 'TODO.md']);

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
    // If TODO.md is deleted, rebuild from CLAUDE.md only
    if (base === 'TODO.md') {
      const projectPath = path.dirname(filePath);
      if (projectStore[projectPath]) {
        rebuildProject(projectPath);
        broadcastAll();
        console.log(`[~] TODO.md removed, falling back to CLAUDE.md: ${path.basename(projectPath)}`);
      }
    }
  });
}

loadAll();
setupWatcher();

server.listen(PORT, () => {
  console.log(`DevBoard running at http://localhost:${PORT}`);
  console.log(`Scanning: ${ROOT_DIR}`);
  console.log(`Found ${Object.keys(projectStore).length} project(s)`);
});
