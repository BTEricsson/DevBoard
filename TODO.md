## Future Ideas (not in scope now)

- Support `todo.md` as a fallback if no `CLAUDE.md` found


## In Progress

- Build kanban frontend

## Tasks

- [x] Scaffold project and install dependencies
- [x] Build scanner.js — discovers projects with CLAUDE.md
- [x] Build parser.js — extracts name, description, tasks, status
- [x] Build server.js — Express + WebSocket + chokidar watcher
- [x] Build public/index.html — kanban UI with live updates
- [x] Add CLAUDE.md for DevBoard itself
- [ ] Test with 3+ real projects
- [ ] Handle edge cases: empty CLAUDE.md, no tasks, nested folders
