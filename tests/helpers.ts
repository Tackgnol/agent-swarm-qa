import { mkdtempSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { approve, initialize, startRun } from '../scripts/workspace.ts';

export const repo = dirname(dirname(fileURLToPath(import.meta.url)));

export function fixture(): { project: string; root: string; run: string } {
  const project = mkdtempSync(join(tmpdir(), 'swarm-qa-test-'));
  const root = initialize(project, 'example');
  copyFileSync(join(repo, 'examples', 'config.json'), join(root, 'config.json'));
  copyFileSync(join(repo, 'examples', 'map.json'), join(root, 'map.json'));
  copyFileSync(join(repo, 'examples', 'scenario.json'), join(root, 'scenarios', 'QA-001.json'));
  // These approvals belong to synthetic offline fixtures, never a real user's QA project.
  for (const subject of ['setup', 'path:PATH-001', 'QA-001']) {
    approve(root, subject, 'offline-test-fixture');
  }
  const run = startRun(root, 'canary', 'first', 'first-run');
  return { project, root, run };
}
