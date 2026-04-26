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
    });
  }
  return projects;
}

module.exports = { scanProjects, readPlanTicket };
