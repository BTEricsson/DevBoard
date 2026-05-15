## Backlog
- nested-project-discovery
- git-status-indicator

### #29 set-task-script
- [~] Add set-task.js — surgical checkbox state update to reduce token usage

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
