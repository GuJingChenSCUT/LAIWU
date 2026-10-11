import { readFileSync, writeFileSync, renameSync, mkdirSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';

export function createStore(path) {
  const projects = new Map();
  if (path && existsSync(path)) {
    const data = JSON.parse(readFileSync(path, 'utf8'));
    if (!Array.isArray(data)) throw new Error('Invalid local project store');
    for (const project of data) {
      if (['queued', 'running'].includes(project.status)) {
        project.status = 'failed';
        project.error = { code: 'INTERRUPTED', message: '上次執行因服務重啟中斷，請重新生成' };
        project.updatedAt = new Date().toISOString();
        for (const step of project.trace || []) if (step.status === 'running') {
          step.status = 'failed';
          // The interruption time is unknown; do not invent a completion time or duration.
          step.interruptedAt = project.updatedAt;
        }
      }
      projects.set(project.id, project);
    }
  }
  return {
    projects,
    save() {
      if (!path) return;
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(`${path}.tmp`, JSON.stringify([...projects.values()], null, 2), 'utf8');
      renameSync(`${path}.tmp`, path);
    }
  };
}
