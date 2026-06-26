const { app, Tray, BrowserWindow, nativeImage, screen, Notification, shell } = require('electron');
const path = require('path');
const envPath = app.isPackaged
  ? path.join(process.resourcesPath, '.env')
  : path.join(__dirname, '..', '.env');
require('dotenv').config({ path: envPath });
const { fork } = require('child_process');
const WebSocket = require('ws');

const PORT = process.env.PORT || 3333;
const BOARD_URL = `http://localhost:${PORT}`;

let tray = null;
let win = null;
let serverProcess = null;
let wsClient = null;
let prevProjects = null;

// ── Server ──────────────────────────────────────────────────────────────────

function startServer() {
  serverProcess = fork(path.join(__dirname, '..', 'server.js'), [], {
    env: { ...process.env },
    silent: false,
  });
  serverProcess.on('exit', (code) => {
    if (code !== 0 && !app.isQuitting) {
      console.error(`[server] exited with code ${code}`);
    }
  });
}

function waitForServer(retries = 20) {
  return new Promise((resolve, reject) => {
    const http = require('http');
    let attempts = 0;
    const check = () => {
      http.get(`${BOARD_URL}/api/projects`, (res) => {
        res.resume();
        resolve();
      }).on('error', () => {
        if (++attempts >= retries) return reject(new Error('Server did not start'));
        setTimeout(check, 300);
      });
    };
    check();
  });
}

// ── Tray window ─────────────────────────────────────────────────────────────

function createWindow() {
  win = new BrowserWindow({
    width: 1100,
    height: 680,
    show: false,
    frame: false,
    resizable: true,
    skipTaskbar: true,
    webPreferences: { nodeIntegration: false, contextIsolation: true },
  });
  win.loadURL(BOARD_URL);
}

function positionWindow() {
  const trayBounds = tray.getBounds();
  const winBounds = win.getBounds();
  const display = screen.getDisplayNearestPoint({ x: trayBounds.x, y: trayBounds.y });
  const workArea = display.workArea;

  let x = Math.round(trayBounds.x + trayBounds.width / 2 - winBounds.width / 2);
  let y;

  if (process.platform === 'win32') {
    // Taskbar is at the bottom — position window above it
    y = workArea.y + workArea.height - winBounds.height - 8;
  } else {
    // macOS menu bar at the top — position window below it
    y = trayBounds.y + trayBounds.height + 4;
  }

  // Keep window within screen bounds
  x = Math.max(workArea.x + 4, Math.min(x, workArea.x + workArea.width - winBounds.width - 4));

  win.setPosition(x, y, false);
}

function toggleWindow() {
  if (win.isVisible()) {
    win.hide();
  } else {
    positionWindow();
    win.show();
    win.focus();
  }
}

// ── Notifications ────────────────────────────────────────────────────────────

// Emit notifications for one project by comparing it to its previous snapshot.
function diffProject(prev, proj) {
  if (!prev) return;

  const prevGroups = Object.fromEntries((prev.tasks?.groups || []).map(g => [g.name, g]));

  for (const group of (proj.tasks?.groups || [])) {
    const prevGroup = prevGroups[group.name];

    // Group just completed
    if (group.status === 'complete' && prevGroup && prevGroup.status !== 'complete') {
      notify(`${proj.name}`, `#${group.ticket || group.name} done`);
    }

    // Task flipped to done
    if (prevGroup) {
      const prevDone = new Set(prevGroup.done || []);
      for (const task of (group.done || [])) {
        if (!prevDone.has(task)) {
          notify(`${proj.name}: ${group.name}`, `✓ ${task}`);
        }
      }
    }
  }

  // PLAN.md added
  if (proj.planTicket && !prev.planTicket) {
    notify(proj.name, `Plan added: ${proj.planTicket}`);
  }
  // PLAN.md removed (group completed)
  if (!proj.planTicket && prev.planTicket) {
    notify(proj.name, `Plan completed: ${prev.planTicket}`);
  }
}

function diffAndNotify(next) {
  if (!prevProjects) { prevProjects = next; return; }

  const prevMap = Object.fromEntries(prevProjects.map(p => [p.id, p]));

  for (const proj of next) {
    const prev = prevMap[proj.id];
    if (!prev) continue;

    diffProject(prev, proj);

    // Nested sub-projects carry no `id`; match them by stable `path`.
    const prevNested = Object.fromEntries((prev.nestedProjects || []).map(n => [n.path, n]));
    for (const nested of (proj.nestedProjects || [])) {
      diffProject(prevNested[nested.path], nested);
    }
  }

  prevProjects = next;
}

function notify(title, body) {
  if (!Notification.isSupported()) return;
  new Notification({ title, body, silent: false }).show();
}

// ── WebSocket watcher ────────────────────────────────────────────────────────

function connectWatcher() {
  wsClient = new WebSocket(`ws://localhost:${PORT}`);
  wsClient.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString());
      if (msg.type === 'update') diffAndNotify(msg.projects);
    } catch (_) {}
  });
  wsClient.on('close', () => {
    if (!app.isQuitting) setTimeout(connectWatcher, 3000);
  });
  wsClient.on('error', () => {});
}

// ── App lifecycle ────────────────────────────────────────────────────────────

app.setName('DevBoard');

app.whenReady().then(async () => {
  app.setActivationPolicy('accessory'); // macOS: no Dock icon

  startServer();
  await waitForServer().catch(err => {
    console.error(err.message);
    app.quit();
  });

  const iconName = process.platform === 'darwin' ? 'iconTemplate.png' : 'icon.png';
  const icon = nativeImage.createFromPath(path.join(__dirname, 'icons', iconName));

  const { Menu } = require('electron');
  tray = new Tray(icon);
  tray.setToolTip('DevBoard');
  tray.on('click', toggleWindow);
  tray.on('right-click', () => {
    tray.popUpContextMenu(Menu.buildFromTemplate([
      { label: 'Open DevBoard', click: toggleWindow },
      { type: 'separator' },
      { label: 'Quit', click: () => app.quit() },
    ]));
  });

  createWindow();
  connectWatcher();
});

app.on('before-quit', () => {
  app.isQuitting = true;
  if (wsClient) wsClient.close();
  if (serverProcess) serverProcess.kill();
});

// Prevent quitting when all windows are closed (stay in tray)
app.on('window-all-closed', (e) => e.preventDefault());
