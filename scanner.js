const fs = require('fs');
const path = require('path');

function readPlanTicket(planMdPath) {
  if (!fs.existsSync(planMdPath)) return null;
  try {
    const first = fs.readFileSync(planMdPath, 'utf8').split('\n').find(l => /^#\s/.test(l));
    if (!first) return null;
    const m = first.match(/^#\s+#(\d+)/);
    return m ? m[1] : null;
  } catch (e) {
    return null;
  }
}

const SKIP_DIRS = new Set(['node_modules', 'vendor', 'dist', 'build', '.git']);

function scanNestedProjects(projectPath) {
  let entries;
  try {
    entries = fs.readdirSync(projectPath, { withFileTypes: true });
  } catch (e) {
    return [];
  }

  const nested = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (entry.name.startsWith('.') || SKIP_DIRS.has(entry.name)) continue;
    const nestedPath = path.join(projectPath, entry.name);
    const claudeMdPath = path.join(nestedPath, 'CLAUDE.md');
    if (!fs.existsSync(claudeMdPath)) continue;
    const todoMdPath = path.join(nestedPath, 'TODO.md');
    const planMdPath = path.join(nestedPath, 'PLAN.md');
    nested.push({
      name: entry.name,
      path: nestedPath,
      claudeMdPath,
      todoMdPath: fs.existsSync(todoMdPath) ? todoMdPath : null,
      planTicket: readPlanTicket(planMdPath),
    });
  }
  return nested;
}

function scanProjects(rootDir) {
  if (!rootDir || !fs.existsSync(rootDir)) return [];

  let entries;
  try {
    entries = fs.readdirSync(rootDir, { withFileTypes: true });
  } catch (e) {
    return [];
  }

  const projects = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const projectPath = path.join(rootDir, entry.name);
    const claudeMdPath = path.join(projectPath, 'CLAUDE.md');
    if (!fs.existsSync(claudeMdPath)) continue;

    const todoMdPath = path.join(projectPath, 'TODO.md');
    const planMdPath = path.join(projectPath, 'PLAN.md');
    projects.push({
      name: entry.name,
      path: projectPath,
      claudeMdPath,
      todoMdPath: fs.existsSync(todoMdPath) ? todoMdPath : null,
      planTicket: readPlanTicket(planMdPath),
      nestedProjects: scanNestedProjects(projectPath),
    });
  }
  return projects;
}

module.exports = { scanProjects, readPlanTicket };
