## Backlog
- git-status-indicator

### #38 check-plan-hook-to-node — 2026-07-15

Port the pre-edit hook from bash (check-plan.sh, needs bash+jq+/dev/tty) to Node (check-plan.js) so the whole .claude toolchain is single-runtime and cross-platform. See PLAN.md.

- [x] 38.1 check-plan.js: read hook JSON from stdin (no jq), same code-file/exempt/PLAN.md logic, block via {decision:block} JSON, drop interactive tty prompt
- [x] 38.2 settings.json: point hook command at 'node .claude/hooks/check-plan.js'; remove check-plan.sh
- [x] 38.3 .gitignore hook rule .sh→.js; update hook description in root CLAUDE.md + swarmMind-api/backoffice mini-tables
- [x] 38.4 Sync check-plan.js + settings.json + .gitignore/doc changes to all synced repos

### #37 task-tooling-read-scripts — 2026-07-15

Three missing .claude task-tooling scripts, tracked in DevBoard because it is the Node.js home for the synced helpers. list-tasks.js only summarizes (hides [x] items, truncates task text at 80 chars, drops the description paragraph), and there is no script to add an item to an existing group — that is hand-edited today. Once built, sync across all repos that use these helpers.

- [x] 37.1 show-task.js <num>: print one task group in full — header, description, and every item incl [x]/[~], untruncated; optionally append the matching PLAN.md section
- [x] 37.2 add-item.js <group#> "<text>": append a checklist item to an existing group, auto-numbered N.(next) from the highest existing sub-number
- [x] 37.3 show-plan.js <num>: print one PLAN.md section by number (reader mirror of add-plan.js)
- [x] 37.4 Sync all three into every repo .claude/ and document them in the CLAUDE.md script tables + task-tracking.md

### #36 dropped-task-state — 2026-07-03
- [x] 36.1 parser.js: recognize `[-]` as a `dropped` bucket (flat + per-group), include in aggregates
- [x] 36.2 parser.js: treat dropped as finished in deriveGroupStatus and project status (complete when no todo/inProgress)
- [x] 36.3 public/index.html: render dropped tasks in Done column, count toward progress/total
- [x] 36.4 public/style.css: dim + strikethrough styling and "dropped" tag for `.task-item.dropped`
- [x] 36.5 cli.js: render dropped tasks in active/complete groups
- [x] 36.6 .claude/set-task.js: add `dropped` → `[-]` state (and sync note)

### #35 nested-group-completion-stamping — 2026-06-26 — 2026-06-26 16:41
- [x] 35.1 Recurse stampCompletedGroups into nestedProjects (write each nested TODO.md) in loadAll and rebuildProject
- [x] 35.2 Treat date-only `— YYYY-MM-DD` group headings as completed (set completedAt) in parser.js
- [x] 35.3 Recognize date-only headings as already-stamped in stampCompletedGroups (stop double-stamping)
- [x] 35.4 Walk nestedProjects in diffAndNotify so nested completions produce notifications

### #34 sub-project-todo-watcher — 2026-06-06 — 2026-06-06 17:06
- [x] 34.1 Export scanNestedProjects from scanner.js
- [x] 34.2 Fix rebuildProject to include nestedProjects
- [x] 34.3 Fix watcher change/unlink handlers to resolve sub-project paths to parent

### #33 electron-blur-fix — 2026-06-01 — 2026-06-01 17:56
- [x] 33.1 Remove blur-to-hide on window focus loss in electron/main.js
- [x] 33.2 Preserve expanded card state across columns on WebSocket update

### #32 task-numbering-format — 2026-05-28 17:46
- [x] 32.1 Update task-tracking.md with N.M numbered subtask rules
- [x] 32.2 Update list-tasks.js and set-task.js header comments for N.M format
- [x] 32.3 Update root CLAUDE.md task-format description

### #31 electron-tray-app — 2026-05-23 THERI — 2026-05-23 08:31 THERI
- [x] Install Electron + menubar package
- [x] Create Electron main process that auto-starts the Node.js server as a child process
- [x] Add tray icon asset and wire up the web board as the popup panel
- [x] Send OS notifications when board changes are detected
- [x] Package for macOS (.dmg) and Windows (.exe)

### #30 nested-project-discovery — 2026-05-17 THERI — 2026-05-17 16:40 THERI
- [x] Extend scanner.js to discover CLAUDE.md files one level deep within each project directory
- [x] Attach nested project data (name, tasks, backlog) to the parent project object
- [x] Render nested project cards within the parent card in the web UI
- [x] Show nested projects in CLI board view

### #29 set-task-script — 2026-05-15 10:28 THERI
- [x] Add set-task.js — surgical checkbox state update to reduce token usage

### #28 parser-name-from-overview-only — 2026-05-01 12:09 THERI
- [x] Only scan the Overview section (up to the first ## heading) for the project name in parser.js

### #26 fix-gitignore-hook — 2026-04-26 22:07 THERI
- [x] Un-ignore .claude/settings.json and .claude/hooks/ so the check-plan hook is tracked by git

### #25 cli-now-view — 2026-04-26 22:07 THERI
- [x] Add "now" mode — shows all active groups across all projects in one view
- [x] Press n from menu to open, b to go back

### #24 cli-show-complete — 2026-04-26 21:19 THERI
- [x] Add completed groups to board view, collapsed by default, toggle with c

### #23 cli-tui — 2026-04-26 21:15 THERI
- [x] Add `npm run cli` command that renders the board in the terminal
- [x] Columnar layout — backlog / pending / active / complete
- [x] Live refresh on file changes (reuse chokidar watcher)
- [x] Keyboard shortcut to quit (q / ctrl+c)

### #22 fix-backlog-card-inline-style — 2026-04-26 20:57 THERI
- [x] Remove inline style="display:flex" from task-list in renderBacklogCard

### #21 collapse-empty-backlog-cards — 2026-04-26 20:52 THERI
- [x] Render backlog card without `expanded` class when backlog is empty and tail is empty

### #20 fix-backlog-tail-filter — 2026-04-25 12:56 THERI
- [x] Filter out complete groups from backlog tail — only show pending/active

### #19 fix-backlog-tail-order — 2026-04-25 12:54 THERI
- [x] Fix `groups.slice(-3)` → `groups.slice(0, 3)` in renderBacklogCard

### #18 view-backlog-tails — 2026-04-25 12:36 THERI
- [x] Expose `hasTodo` boolean on project data in parser.js
- [x] Pass `hasTodo` through server.js to the client
- [x] In renderAll, add a backlog card when hasTodo && backlog.length === 0
- [x] Update renderBacklogCard to show tail task groups when backlog is empty

### #17 fix-date-nick — 2026-04-23 22:52 THERI
- [x] Remove creation date+nick from group headings — only write stamp on completion
- [x] Update parser.js to handle headings with and without completion stamp
- [x] Validate heading format end-to-end

### #16 vscode-button — 2026-04-23 22:27 THERI
- [x] Add project path to server data
- [x] Render "Open in VS Code" button on each project card using vscode://file/<path>

### #15 planmd-badge-fix — 2026-04-23 21:53 THERI
- [x] Parse ticket/name from PLAN.md first heading in scanner.js
- [x] Expose planTicket on project data instead of hasPlan bool
- [x] Only show PLAN badge on the group card whose ticket matches

### #14 planmd-badge — 2026-04-23 21:49 THERI
- [x] Detect PLAN.md existence per project in scanner.js
- [x] Expose hasPlan flag on project data from server
- [x] Render PLAN badge on project cards in the UI
- [x] Test it end-to-end

### #13 audit-deps — 2026-04-23 21:29 THERI
- [x] Identify unused dependencies with depcheck or npm ls
- [x] Remove confirmed unused packages from package.json
- [x] Verify app still works after removal

### #12 extract-css — 2026-04-23 21:24 THERI
- [x] Move inline <style> block from index.html to public/style.css
- [x] Link stylesheet from index.html

### #11 nick-in-stamp — 2026-04-22 21:31 THERI
- [x] Write nick into the completion stamp in TODO.md (e.g. — 2026-04-22 21:12 THERI)
- [x] Parse nick out of the stamp in parser.js
- [x] Remove server-side nick fallback from renderGroupCard — nick now comes only from the stamp

### #10 nick-prompt — 2026-04-22 21:23
- [x] On startup check .env for NICK — if missing, prompt user in terminal
- [x] Derive nick from input (first name max 4 chars uppercase, or use as-is if ≤5 chars)
- [x] Ask if user wants to save nick to .env
- [x] Pass global nick to all projects as fallback when CLAUDE.md has no nick: field

### #9 nick-on-complete — 2026-04-22 21:15
- [x] Parse nick: field from CLAUDE.md in parser.js
- [x] Expose nick on project data
- [x] Show nick badge on completed group cards in the UI

### #8 column-show-more — 2026-04-22 21:12
- [x] Show only 6 cards per column on load
- [x] Add "Show more" button at the bottom of each column when there are more cards
- [x] Clicking it reveals the remaining cards

### #7 fix-backlog-parsing — 2026-04-22 20:54
- [x] Reset inBacklogSection when a ### group heading is encountered

### #6 status-row-datetime — 2026-04-22 20:38
- [x] Move completedAt to same row as status badge in group cards

### #5 board-ux — 2026-04-22 20:24
- [x] Sort complete column by completedAt descending (newest first)
- [x] Hide groups with no tasks from the pending column

### #4 remove-claudemd-fallback — 2026-04-22 20:20
- [x] Remove fallback to CLAUDE.md for task parsing in parser.js — if no TODO.md, return empty tasks

### #3 datetime-on-complete — 2026-04-22 20:16
- [x] Update parser.js — extract completedAt from group headings
- [x] Add POST /api/complete-group endpoint — writes datetime to group heading in TODO.md
- [x] Update UI — mark-complete button on groups, show datetime on complete groups

### #2 task-groups — 2026-04-22 20:16
- [x] Backlog section support
- [x] Manual status override
- [x] Task group parsing with ticket numbers
- [x] Test groups end-to-end

### #1 init-build — 2026-04-22 20:16
- [x] Scaffold project and install dependencies
- [x] Build scanner.js — discovers projects with CLAUDE.md
- [x] Build parser.js — extracts name, description, tasks, status
- [x] Build server.js — Express + WebSocket + chokidar watcher
- [x] Build public/index.html — kanban UI with live updates
- [x] Add CLAUDE.md for DevBoard itself
