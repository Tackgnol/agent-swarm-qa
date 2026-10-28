import assert from 'node:assert/strict';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { approvalHash, loadSuite, safeId, writeJson } from './workspace.ts';
import type { PathEntry, Scenario } from './models.ts';

function title(value: string): string {
  assert.ok(typeof value === 'string' && value.trim(), 'Feature/scenario titles must be nonempty.');
  return value.replace(/\s+/gu, ' ').trim();
}

/** Preserve multiline wording as a JSON doc string rather than flattening it or injecting syntax. */
function steps(keyword: 'Given' | 'When' | 'Then', bodies: string[]): string[] {
  assert.ok(Array.isArray(bodies), 'Step bodies must be arrays.');
  return bodies.flatMap((body, index) => {
    assert.ok(typeof body === 'string' && body.trim(), 'Approved step bodies must be nonempty strings.');
    const prefix = index === 0 ? keyword : 'And';
    if (/[\u0000-\u001f\u007f\u2028\u2029]/u.test(body)) {
      const kind = { Given: 'precondition', When: 'action', Then: 'expected outcome' }[keyword];
      return [`    ${prefix} the approved ${kind} is described by this JSON string:`, '      ```json', `      ${JSON.stringify(body)}`, '      ```'];
    }
    return [`    ${prefix} ${body.trim()}`];
  });
}

export function renderFeature(path: PathEntry, scenarios: Scenario[]): string {
  const lines = [
    '# language: en', '# Draft translation of approved specs. No observed results are inputs.',
    `@qa @draft @${safeId(path.id)}`, `Feature: ${title(path.title)}`, '',
    `  Agreed behavior for ${title(path.title)}.`, '',
  ];
  for (const scenario of scenarios) {
    assert.ok(scenario.steps.length > 0 && scenario.expected.length > 0, 'An exported scenario needs actions and expected outcomes.');
    lines.push(`  @${safeId(scenario.id)} @${scenario.critical ? 'critical' : 'optional'}`,
      `  Scenario: ${scenario.id} - ${title(scenario.title)}`,
      `    # Approved boundary: ${title(scenario.boundary)}`,
      ...steps('Given', scenario.preconditions), ...steps('When', scenario.steps), ...steps('Then', scenario.expected), '');
  }
  return `${lines.join('\n')}\n`;
}

/** Export current approved contracts only. Never open run results, reports, evidence or .env.qa. */
export function exportGherkin(root: string, exportId: string): string {
  const directory = join(root, 'exports', 'gherkin', safeId(exportId));
  assert.ok(!existsSync(directory), 'Export already exists; choose a new ID so reviewed files are preserved.');
  const suite = loadSuite(root);
  const byId = new Map(suite.scenarios.map(scenario => [scenario.id, scenario]));
  const paths = suite.map.paths.filter(path => path.disposition === 'included').sort((a, b) => a.id.localeCompare(b.id, 'en', { numeric: true }));
  // Render everything before creating output, so invalid text leaves no partial feature set.
  const features = paths.map(path => {
    const scenarios = path.scenarioIds.map(id => byId.get(id)!);
    return { path, scenarios, file: `${path.id}.feature`, content: renderFeature(path, scenarios) };
  });
  mkdirSync(join(root, 'exports', 'gherkin'), { recursive: true });
  mkdirSync(directory);
  for (const feature of features) {
    writeFileSync(join(directory, feature.file), feature.content, { encoding: 'utf8', flag: 'wx' });
  }
  writeJson(join(directory, 'manifest.json'), {
    version: 1, draft: true, source: 'current-approved-specs', project: suite.config.project, suiteHash: suite.hash,
    files: features.map(feature => ({
      file: feature.file, pathId: feature.path.id,
      scenarios: feature.scenarios.map(scenario => ({ id: scenario.id, source: `scenarios/${scenario.id}.json`, contentHash: approvalHash(scenario) })),
    })),
    excludedPaths: suite.map.paths.filter(path => path.disposition === 'excluded').map(path => ({ id: path.id, reason: path.reason })),
  });
  return directory;
}
