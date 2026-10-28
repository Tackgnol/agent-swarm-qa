import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { approve, initialize, readJson, startRun, writeJson } from './workspace.ts';
import { writeReport } from './report.ts';
import type { PathMap, Result, Run, Scenario } from './models.ts';

const repo = dirname(dirname(fileURLToPath(import.meta.url)));
const project = join(repo, '.scratch', 'demo-product');
mkdirSync(project, { recursive: true });
const root = join(project, '.scratch', 'QA', 'demo');
if (!existsSync(root)) {
  initialize(project, 'demo');
  copyFileSync(join(repo, 'examples', 'config.json'), join(root, 'config.json'));
  const template = readJson<Scenario>(join(repo, 'examples', 'scenario.json'));
  const definitions = [
    { id: 'QA-001', title: 'Saved draft survives reload', route: '/drafts/:id', critical: true },
    { id: 'QA-002', title: 'Member changes appear in the owner roster', route: '/party/:id', critical: true },
    { id: 'QA-003', title: 'Approval returns the verified receiving identity', route: '/approval', critical: true },
    { id: 'QA-004', title: 'Exported pages remain readable', route: '/export', critical: false },
  ];
  const map: PathMap = { version: 1, paths: [] };
  for (const entry of definitions) {
    const pathId = `PATH-${entry.id.slice(3)}`;
    const scenario: Scenario = {
      ...template, id: entry.id, title: entry.title, pathId, critical: entry.critical,
      boundary: 'OFFLINE DEMO: synthetic fixture, not a deployed app',
      steps: [`Exercise the simulated ${entry.title.toLowerCase()} flow`],
      expected: ['The approved observable outcome is established at its actual boundary'],
    };
    writeJson(join(root, 'scenarios', `${entry.id}.json`), scenario);
    map.paths.push({ id: pathId, title: entry.title, route: entry.route, scenarioIds: [entry.id], disposition: 'included', reason: 'Synthetic visual example only', approval: null });
  }
  writeJson(join(root, 'map.json'), map);
  for (const subject of ['setup', ...map.paths.map(path => `path:${path.id}`), ...definitions.map(entry => entry.id)]) {
    approve(root, subject, 'SYNTHETIC DEMO — not an actual user approval');
  }
}
const runId = `demo-${Date.now()}`;
const directory = startRun(root, 'canary', runId, 'first-run');
const run = readJson<Run>(join(directory, 'run.json'));
run.observedBuild = 'OFFLINE DEMO · simulated asset main-example.js · no real environment tested';
run.limits = ['All observations and approvals in this report are synthetic examples. No live QA, account login or deployment occurred.'];
run.findings.push({ id: 'DEMO-01', title: 'Owner roster remains stale until reload', kind: 'synthetic product finding', impact: 'critical journey', scenarioIds: ['QA-002'] });
run.automated.push({ name: 'Example unit suite', boundary: 'synthetic local fixture', passed: 12, failed: 0, skipped: 0, log: 'Illustrative totals only; not an executed suite' });
run.fuzzing.push({ name: 'Example contract triage', executed: 8, rawErrors: 2, rawWarnings: 1, confirmedDefects: 1, log: 'Illustrative classifications only; no requests sent' });
writeJson(join(directory, 'run.json'), run);
const statuses = ['passed', 'failed', 'blocked', 'not-run'] as const;
const observations = ['Synthetic saved title matches after reload.', 'Synthetic member HP saved; owner view stays stale until manual reload.', 'Synthetic host access is unavailable; receiving identity cannot be verified.', 'Optional export case is explicitly deferred in this demonstration.'];
const results: Result[] = statuses.map((status, index) => ({
  scenarioId: `QA-00${index + 1}`, attempt: 1, status, at: new Date().toISOString(), actual: observations[index],
  browser: 'Synthetic Chromium example', viewport: '390x844', locale: 'en', boundary: 'OFFLINE DEMO: synthetic fixture, not a deployed app', screenshots: [], evidence: ['Synthetic fixture; no live test evidence'],
}));
const image = join(repo, 'examples', 'synthetic-screen.png');
if (existsSync(image)) {
  copyFileSync(image, join(directory, 'screenshots', 'synthetic-screen.png'));
  results[0].screenshots.push({ path: 'screenshots/synthetic-screen.png', caption: 'Offline visual fixture — not a screenshot of a tested product', inspected: true });
}
writeJson(join(directory, 'results.json'), results);
console.log(writeReport(root, runId));
