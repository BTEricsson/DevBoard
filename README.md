# DevBoard

A local Node.js web dashboard that scans a root folder for projects with a `CLAUDE.md` file and displays them as a live kanban board.

Runs on **macOS, Linux, and Windows**.

## Requirements

- Node.js 18+

## Setup

```bash
npm install
```

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```



```env
ROOT_DIR=..
PORT=3333
```

If DevBoard lives inside your projects folder, `ROOT_DIR=..` points one level up and scans everything around it — no hardcoded path needed, works on any machine and any OS.

For a custom location use an absolute path (forward slashes on all platforms):

```env
ROOT_DIR=C:/Users/username/Projects
PORT=3333
```

## Start

```bash
npm start
```

Open [http://localhost:3333](http://localhost:3333).

## Desktop app (macOS / Windows)

DevBoard can run as a native tray app — no browser or terminal needed.

### Build

```bash
npm run dist:mac   # → dist/DevBoard-1.0.0-arm64.dmg  (Apple Silicon)
                   # → dist/DevBoard-1.0.0.dmg         (Intel)
npm run dist:win   # → dist/DevBoard Setup 1.0.0.exe
```

### Install (macOS)

1. Open the `.dmg` and drag **DevBoard** to Applications
2. First launch: macOS will block the unsigned app — go to **System Settings → Privacy & Security** and click **Open Anyway**
3. DevBoard appears as an icon in the menu bar (top right)

### Usage

| Action | How |
|--------|-----|
| Show/hide board | Click the tray icon |
| Quit | Right-click the tray icon → **Quit** |

The app auto-starts the web server on launch — no manual `npm start` needed. OS notifications fire automatically when tasks are completed or task groups change.

### .env for the installed app

The `.env` file is bundled inside the app at build time. `ROOT_DIR` must be an **absolute path** when building for distribution:

```env
ROOT_DIR=/Users/username/Developer
PORT=3333
```

After changing `.env`, rebuild with `npm run dist:mac` to pick up the new config.

### Dev mode

To run the tray app without packaging:

```bash
npm run electron
```

## CLI

Run the board in the terminal without a browser:

```bash
npm run cli
```

Renders all projects as a live terminal UI that auto-refreshes whenever `CLAUDE.md` or `TODO.md` changes.

### Modes

**Menu** — project list on startup

| Key | Action |
|-----|--------|
| `↑` / `↓` | Navigate projects |
| `Enter` | Open project board |
| `n` | Open "Now" view |
| `q` | Quit |

**Board** — task groups for a selected project

| Key | Action |
|-----|--------|
| `↑` / `↓` or `j` / `k` | Scroll |
| `c` | Toggle completed groups |
| `b` / `Esc` | Back to menu |
| `q` | Quit |

**Now** — all active groups across all projects

| Key | Action |
|-----|--------|
| `↑` / `↓` or `j` / `k` | Scroll |
| `b` / `Esc` | Back to menu |
| `q` | Quit |

## How it works

- Scans `ROOT_DIR` for subdirectories containing a `CLAUDE.md` file
- Parses each project's `TODO.md` for task groups, backlog items, and completion status
- Displays projects as a kanban board with three columns: Pending, Active, Complete
- Live-reloads via WebSocket whenever `CLAUDE.md` or `TODO.md` changes

## Workflow (Claude Code)

DevBoard uses Claude Code and has conventions baked in to keep work structured.

### Task tracking

Tasks and progress live in `TODO.md`:

- `## Backlog` at the top — future ideas, one item per line
- `### #N group-name` — a named task group with `- [ ]` tasks
- `- [ ]` todo, `- [~]` in progress, `- [x]` done
- New task groups go directly below `## Backlog`; completed ones accumulate at the bottom
- When a group is marked complete a timestamp + nick stamp is appended to the heading, e.g. `### #5 my-feature — 2026-04-22 21:12 THERI`

### Planning

Before starting a task group, create `PLAN.md` in the repo root with the design and rationale. Delete it when the group is done. Only one plan exists at a time.

### check-plan hook

A Claude Code `PreToolUse` hook (`.claude/hooks/check-plan.sh`) blocks edits to `.js`, `.html`, `.css`, and `.php` files if `PLAN.md` is missing. This enforces the plan-before-code rule automatically.

When Claude tries to edit a code file without a plan it will be prompted:

```
No PLAN.md found. Continue anyway? [y/N]
```

The hook is already wired up in `.claude/settings.json` — it activates automatically when you open the project in Claude Code.

## Project detection

A folder is treated as a project if it contains a `CLAUDE.md` file. Optionally add a `TODO.md` for task tracking.

### Group folders

A folder can act as a **group** that contains multiple sub-projects. Add a `CLAUDE.md` to the group folder itself — DevBoard will then scan one level deeper and surface each sub-project as a nested card on the board.

```
~/Projects/
  my-group/           ← group folder (needs its own CLAUDE.md)
    CLAUDE.md
    service-a/        ← sub-project (needs its own CLAUDE.md + optional TODO.md)
      CLAUDE.md
      TODO.md
    service-b/
      CLAUDE.md
      TODO.md
```

Sub-project cards are visually distinct: they have a colored left-border stripe and display the parent folder name as a breadcrumb above the project name.

### CLAUDE.md conventions

- First `# Heading` → project name
- First plain paragraph after the heading → description
- `status: active|pending|complete` line → manual status override

### TODO.md conventions

- `## Backlog` section → backlog items (bullet list)
- `### #N group-name` headings → task groups
- `- [ ]` todo, `- [~]` in progress, `- [x]` done
