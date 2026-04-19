const fs = require('fs');
const path = require('path');

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
    projects.push({
      name: entry.name,
      path: projectPath,
      claudeMdPath,
      todoMdPath: fs.existsSync(todoMdPath) ? todoMdPath : null,
    });
  }
  return projects;
}

module.exports = { scanProjects };
