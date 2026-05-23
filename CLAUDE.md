# DevBoard

A local Node.js web dashboard that scans a root folder for projects with a CLAUDE.md file and displays them as a live kanban board.

## Cross-Platform

All code must run on macOS, Linux, and Windows without modification:

- Use `path.join`, `path.resolve`, `path.basename` etc. — never hardcode `/` or `\` as separators
- No shell commands, Unix-specific syscalls, or platform-specific APIs
- `ROOT_DIR` in `.env` should use forward slashes on all platforms (e.g. `C:/Users/...` on Windows)

## Nested projects

A folder with its own `CLAUDE.md` is treated as a **group**. DevBoard scans one level inside it for sub-projects (each also needing a `CLAUDE.md`). Sub-project cards appear on the board with a colored left-border stripe and a breadcrumb showing the group name.

## CLI

`npm run cli` runs the board as a terminal UI (`cli.js`). It uses the same scanner/parser as the web server and live-reloads on file changes via chokidar.

@../.claude/task-tracking.md

