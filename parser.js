const fs = require('fs');
const path = require('path');

function extractTasks(content) {
  const lines = content.split('\n');
  const todo = [];
  const inProgress = [];
  const done = [];
  let inInProgressSection = false;

  for (const line of lines) {
    if (/^#{1,6}\s/.test(line)) {
      const heading = line.replace(/^#+\s+/, '').trim().toLowerCase();
      inInProgressSection = heading === 'in progress';
      continue;
    }
    if (/^[-*]\s+\[\s\]\s+/.test(line)) {
      todo.push(line.replace(/^[-*]\s+\[\s\]\s+/, '').trim());
    } else if (/^[-*]\s+\[[xX]\]\s+/.test(line)) {
      done.push(line.replace(/^[-*]\s+\[[xX]\]\s+/, '').trim());
    } else if (/^[-*]\s+\[~\]\s+/.test(line)) {
      inProgress.push(line.replace(/^[-*]\s+\[~\]\s+/, '').trim());
    } else if (inInProgressSection && /^[-*]\s+/.test(line)) {
      const text = line.replace(/^[-*]\s+/, '').trim();
      if (text) inProgress.push(text);
    }
  }
  return { todo, inProgress, done };
}

function parseProject(proj) {
  const { name: folderName, claudeMdPath, todoMdPath } = proj;

  // Name + description always from CLAUDE.md
  let name = folderName;
  let description = '';
  let claudeContent = '';
  try {
    claudeContent = fs.readFileSync(claudeMdPath, 'utf8');
    const lines = claudeContent.split('\n');
    const headingLine = lines.find(l => /^#\s/.test(l));
    name = headingLine ? headingLine.replace(/^#+\s+/, '').trim() : folderName;

    let foundHeading = false;
    for (const line of lines) {
      if (!foundHeading && /^#\s/.test(line)) { foundHeading = true; continue; }
      if (!foundHeading) continue;
      const trimmed = line.trim();
      if (!trimmed) continue;
      if (/^#+/.test(trimmed) || /^[-*]/.test(trimmed)) break;
      description = trimmed;
      break;
    }
  } catch (e) {}

  // Tasks from TODO.md if present, otherwise from CLAUDE.md
  let tasks = { todo: [], inProgress: [], done: [] };
  let taskFilePath = claudeMdPath;
  if (todoMdPath) {
    try {
      const todoContent = fs.readFileSync(todoMdPath, 'utf8');
      tasks = extractTasks(todoContent);
      taskFilePath = todoMdPath;
    } catch (e) {
      tasks = extractTasks(claudeContent);
    }
  } else {
    tasks = extractTasks(claudeContent);
  }

  // Derive status
  const total = tasks.todo.length + tasks.inProgress.length + tasks.done.length;
  let status = 'pending';
  if (total > 0 && tasks.done.length === total) {
    status = 'complete';
  } else if (tasks.inProgress.length > 0 || tasks.done.length > 0) {
    status = 'active';
  }

  // Last modified: most recent of CLAUDE.md and TODO.md
  let lastModified = null;
  try {
    const times = [fs.statSync(claudeMdPath).mtime];
    if (todoMdPath) times.push(fs.statSync(todoMdPath).mtime);
    lastModified = new Date(Math.max(...times)).toISOString();
  } catch (e) {}

  return { name, description, tasks, status, lastModified };
}

module.exports = { parseProject };
