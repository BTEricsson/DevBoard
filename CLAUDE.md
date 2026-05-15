# DevBoard

A local Node.js web dashboard that scans a root folder for projects with a CLAUDE.md file and displays them as a live kanban board.

## Cross-Platform

All code must run on macOS, Linux, and Windows without modification:

- Use `path.join`, `path.resolve`, `path.basename` etc. — never hardcode `/` or `\` as separators
- No shell commands, Unix-specific syscalls, or platform-specific APIs
- `ROOT_DIR` in `.env` should use forward slashes on all platforms (e.g. `C:/Users/...` on Windows)

## Task Tracking

Tasks and progress are tracked in `TODO.md`. Always keep it up to date:

- When starting a task → mark it `- [~]`
- When done → mark it `- [x]`
- Use `node .claude/set-task.js <state> <pattern>` to update a single checkbox without rewriting the whole file (states: `pending`, `active`, `done`)
- New ideas or future work → add to `## Backlog`, not to a group
- New feature work → create a new `### #N group-name` with `- [ ]` tasks, placed directly below `## Backlog`

`## Backlog` is always at the top of `TODO.md`. New task groups go directly below it. Older completed groups accumulate at the bottom.

Never leave a task as `[~]` once it is complete.

Always add the task to `TODO.md` before implementing — even for small changes. No exceptions.

Before making any code change, ask the user: "Do you want to add this to TODO.md first?" — only skip if the user explicitly says no or has already added it.

## CLI

`npm run cli` runs the board as a terminal UI (`cli.js`). It uses the same scanner/parser as the web server and live-reloads on file changes via chokidar.

## Planning

Active task group plans are stored in `PLAN.md`:

- When starting a new task group → create `PLAN.md` with the design and rationale
- When the group is done → delete `PLAN.md`
- Only one plan at a time — `PLAN.md` always describes the current ongoing group

