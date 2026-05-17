const fs = require('fs');
const path = require('path');

// Parse a ### heading into { ticket, name }
// Supports: "### #1 init-build", "### init-build", "### init-build (#1)"
function parseGroupHeading(raw) {
  let ticket = null;
  let name = raw.trim();
  let completedAt = null;
  let nick = null;

  // Extract trailing completion stamp " — YYYY-MM-DD HH:MM [NICK]"
  const tsMatch = name.match(/\s+—\s+(\d{4}-\d{2}-\d{2} \d{2}:\d{2})(?:\s+([A-Z]{2,5}))?$/);
  if (tsMatch) {
    completedAt = tsMatch[1];
    if (tsMatch[2]) nick = tsMatch[2];
    name = name.slice(0, tsMatch.index).trim();
  }

  // Strip any spurious date-only stamp " — YYYY-MM-DD [NICK]" (no time component)
  const dateOnlyMatch = name.match(/\s+—\s+\d{4}-\d{2}-\d{2}(?:\s+[A-Z]{2,5})?$/);
  if (dateOnlyMatch) {
    name = name.slice(0, dateOnlyMatch.index).trim();
  }

  // "### #1 group-name"
  const leadTicket = name.match(/^#(\d+)\s+(.+)/);
  if (leadTicket) {
    ticket = leadTicket[1];
    name = leadTicket[2].trim();
    return { ticket, name, completedAt, nick };
  }

  // "### group-name (#1)"
  const trailTicket = name.match(/^(.+?)\s+\(#(\d+)\)$/);
  if (trailTicket) {
    name = trailTicket[1].trim();
    ticket = trailTicket[2];
    return { ticket, name, completedAt, nick };
  }

  return { ticket, name, completedAt, nick };
}

function deriveGroupStatus(todo, inProgress, done) {
  const total = todo.length + inProgress.length + done.length;
  if (total === 0) return 'pending';
  if (done.length === total) return 'complete';
  if (inProgress.length > 0 || done.length > 0) return 'active';
  return 'pending';
}

function extractTasks(content) {
  const lines = content.split('\n');

  // Flat accumulators (ungrouped tasks + aggregate for progress bar)
  const todo = [];
  const inProgress = [];
  const done = [];
  const backlog = [];
  const groups = [];

  let inBacklogSection = false;
  let inInProgressSection = false;
  let currentGroup = null; // { ticket, name, todo, inProgress, done }

  for (const line of lines) {
    // ## section headings
    if (/^#{2}\s/.test(line) && !/^#{3}/.test(line)) {
      const heading = line.replace(/^#+\s+/, '').trim().toLowerCase();
      inBacklogSection = heading === 'backlog';
      inInProgressSection = heading === 'in progress';
      currentGroup = null; // sections reset active group
      continue;
    }

    // ### group headings
    if (/^#{3}\s/.test(line)) {
      inBacklogSection = false; // task groups always follow the backlog section
      const raw = line.replace(/^#+\s+/, '').trim();
      const { ticket, name, completedAt, nick } = parseGroupHeading(raw);
      currentGroup = { ticket, name, completedAt, nick, todo: [], inProgress: [], done: [] };
      groups.push(currentGroup);
      continue;
    }

    // Skip deeper headings
    if (/^#{4,}\s/.test(line)) {
      currentGroup = null;
      continue;
    }

    // Backlog items
    if (inBacklogSection && /^[-*]\s+/.test(line)) {
      const text = line.replace(/^[-*]\s+(\[.\]\s+)?/, '').trim();
      if (text) backlog.push(text);
      continue;
    }

    // Task lines
    const isTodo = /^[-*]\s+\[\s\]\s+/.test(line);
    const isDone = /^[-*]\s+\[[xX]\]\s+/.test(line);
    const isInProgress = /^[-*]\s+\[~\]\s+/.test(line);
    const isPlain = !isTodo && !isDone && !isInProgress && /^[-*]\s+/.test(line);

    if (!isTodo && !isDone && !isInProgress && !(isPlain && (inInProgressSection || currentGroup))) continue;

    let text = '';
    if (isTodo) text = line.replace(/^[-*]\s+\[\s\]\s+/, '').trim();
    else if (isDone) text = line.replace(/^[-*]\s+\[[xX]\]\s+/, '').trim();
    else if (isInProgress) text = line.replace(/^[-*]\s+\[~\]\s+/, '').trim();
    else text = line.replace(/^[-*]\s+/, '').trim();
    if (!text) continue;

    // Determine which bucket
    let bucket;
    if (isDone) bucket = 'done';
    else if (isInProgress) bucket = 'inProgress';
    else if (isPlain && inInProgressSection) bucket = 'inProgress';
    else bucket = 'todo';

    if (currentGroup) {
      currentGroup[bucket].push(text);
    }
    // Always add to flat aggregates (for progress bar)
    if (bucket === 'done') done.push(text);
    else if (bucket === 'inProgress') inProgress.push(text);
    else todo.push(text);
  }

  // Derive status for each group
  const processedGroups = groups.map(g => ({
    ticket: g.ticket,
    name: g.name,
    completedAt: g.completedAt,
    nick: g.nick,
    todo: g.todo,
    inProgress: g.inProgress,
    done: g.done,
    status: deriveGroupStatus(g.todo, g.inProgress, g.done),
  }));

  return { todo, inProgress, done, backlog, groups: processedGroups };
}

function parseProject(proj) {
  const { name: folderName, claudeMdPath, todoMdPath } = proj;

  let name = folderName;
  let description = '';
  let statusOverride = null;
  let nick = null;
  let claudeContent = '';

  try {
    claudeContent = fs.readFileSync(claudeMdPath, 'utf8');
    const lines = claudeContent.split('\n');

    const firstSectionIdx = lines.findIndex((l, i) => i > 0 && /^#{2}\s/.test(l));
    const overviewLines = lines.slice(0, firstSectionIdx === -1 ? lines.length : firstSectionIdx);
    const headingLine = overviewLines.find(l => /^#\s/.test(l));
    name = headingLine ? headingLine.replace(/^#+\s+/, '').trim() : folderName;

    const statusLine = lines.find(l => /^status\s*:/i.test(l));
    if (statusLine) {
      const val = statusLine.replace(/^status\s*:\s*/i, '').trim().toLowerCase();
      if (['pending', 'active', 'complete'].includes(val)) statusOverride = val;
    }

    const nickLine = lines.find(l => /^nick\s*:/i.test(l));
    if (nickLine) {
      const val = nickLine.replace(/^nick\s*:\s*/i, '').trim().slice(0, 5).toUpperCase();
      if (val) nick = val;
    }

    let foundHeading = false;
    for (const line of lines) {
      if (!foundHeading && /^#\s/.test(line)) { foundHeading = true; continue; }
      if (!foundHeading) continue;
      const trimmed = line.trim();
      if (!trimmed) continue;
      if (/^#+/.test(trimmed) || /^[-*]/.test(trimmed) || /^status\s*:/i.test(trimmed)) break;
      description = trimmed;
      break;
    }
  } catch (e) {}

  let tasks = { todo: [], inProgress: [], done: [], backlog: [], groups: [] };
  if (todoMdPath) {
    try {
      tasks = extractTasks(fs.readFileSync(todoMdPath, 'utf8'));
    } catch (e) {}
  }

  // Derive project status from non-backlog aggregates
  let status = statusOverride;
  if (!status) {
    const total = tasks.todo.length + tasks.inProgress.length + tasks.done.length;
    if (total > 0 && tasks.done.length === total) status = 'complete';
    else if (tasks.inProgress.length > 0 || tasks.done.length > 0) status = 'active';
    else status = 'pending';
  }

  let lastModified = null;
  try {
    const times = [fs.statSync(claudeMdPath).mtime];
    if (todoMdPath) times.push(fs.statSync(todoMdPath).mtime);
    lastModified = new Date(Math.max(...times)).toISOString();
  } catch (e) {}

  const nestedProjects = (proj.nestedProjects || []).map(n => ({ ...parseProject(n), path: n.path }));

  return { name, description, tasks, status, statusOverride: !!statusOverride, nick, lastModified, hasTodo: !!todoMdPath, nestedProjects };
}

module.exports = { parseProject };
