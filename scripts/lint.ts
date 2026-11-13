import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { loadInteractions, resolveOperation } from './interactions.ts';
import { readJson, writeJson } from './store.ts';
import { withChartLock } from './wayfinding.ts';
import type { PathMap, Scenario } from './models.ts';

/** Check draft scenarios before anyone is asked to approve them. Problems block; warnings are for the author to judge. */
export function lintScenarios(root: string, only: string[] = []): { text: string; problems: number } {
  const map = readJson<PathMap>(join(root, 'map.json'));
  const interactions = loadInteractions(root);
  const directory = join(root, 'scenarios');
  const files = existsSync(directory) ? readdirSync(directory).filter(file => file.endsWith('.json')).sort() : [];
  const lines: string[] = [];
  let problems = 0;
  const seen = new Set<string>();
  for (const file of files) {
    const scenario = readJson<Scenario>(join(directory, file));
    seen.add(scenario.id);
    if (only.length && !only.includes(scenario.id)) {
      continue;
    }
    const issues: string[] = [];
    const warnings: string[] = [];
    const path = map.paths.find(entry => entry.id === scenario.pathId);
    if (`${scenario.id}.json` !== file) { issues.push('the file name must be <id>.json'); }
    if (!path) { issues.push(`unknown capability path ${scenario.pathId}`); }
    for (const key of ['title', 'boundary'] as const) {
      if (typeof scenario[key] !== 'string' || !scenario[key].trim()) { issues.push(`missing ${key}`); }
    }
    for (const key of ['identities', 'preconditions', 'steps', 'expected', 'evidence', 'cleanup'] as const) {
      if (!Array.isArray(scenario[key])) { issues.push(`${key} must be a list`); }
    }
    if (!scenario.steps?.length || !scenario.expected?.length) { issues.push('needs steps and expected outcomes'); }
    if (scenario.tier !== undefined && !['happy', 'error', 'adversarial'].includes(scenario.tier)) { issues.push('tier must be happy, error or adversarial'); }
    if (scenario.tier === 'adversarial' && !scenario.rule?.trim()) { issues.push('an adversarial scenario names the rule it tries to break'); }
    if (typeof scenario.critical !== 'boolean') { issues.push('critical must be true or false'); }
    for (const operation of scenario.operations ?? []) {
      try {
        const found = resolveOperation(interactions, operation);
        if (found.status === 'deferred') { warnings.push(`${operation} is deferred: the run operates it for the first time`); }
      } catch (error) {
        issues.push((error as Error).message);
      }
    }
    if (!scenario.operations?.length) { warnings.push('no operations: say in the boundary or evidence why (API-only check, barrier)'); }
    const rules = path?.intent?.rules ?? [];
    if (!scenario.rule?.trim()) {
      warnings.push('no rule named: every expected outcome should trace to a settled rule');
    } else if (rules.length && !scenario.rule.split(' / ').every(part => rules.some(rule => rule.trim() === part.trim()))) {
      warnings.push('the rule text does not match a rule of its capability word for word: check it still traces to settled intent');
    }
    problems += issues.length;
    lines.push(`${scenario.id} ${issues.length ? 'PROBLEMS' : warnings.length ? 'ok, with warnings' : 'ok'} · ${scenario.tier ?? 'happy'} · ${scenario.title}`);
    lines.push(...issues.map(issue => `   problem: ${issue}`), ...warnings.map(warning => `   warning: ${warning}`));
  }
  for (const id of only.filter(id => !seen.has(id))) {
    problems += 1;
    lines.push(`${id} PROBLEMS`, '   problem: no such scenario file');
  }
  for (const path of map.paths.filter(entry => entry.disposition !== 'excluded' && entry.intent)) {
    const covered = files.map(file => readJson<Scenario>(join(directory, file))).filter(scenario => scenario.pathId === path.id).flatMap(scenario => (scenario.rule ?? '').split(' / ').map(part => part.trim()));
    const uncovered = path.intent!.rules.filter(rule => !rule.startsWith('Boundary') && !covered.includes(rule.trim()));
    if (!only.length && uncovered.length) {
      lines.push(`${path.id} ${path.title}: rules no scenario names yet:`, ...uncovered.map(rule => `   - ${rule}`));
    }
  }
  lines.push('', `${problems} ${problems === 1 ? 'problem' : 'problems'}.`);
  return { text: lines.join('\n'), problems };
}

/** Point each capability at its scenario files, so parallel authors never edit map.json. */
export function wireScenarios(root: string): string {
  return withChartLock(root, () => wire(root));
}

function wire(root: string): string {
  const file = join(root, 'map.json');
  const map = readJson<PathMap>(file);
  const directory = join(root, 'scenarios');
  const scenarios = existsSync(directory) ? readdirSync(directory).filter(name => name.endsWith('.json')).sort().map(name => readJson<Scenario>(join(directory, name))) : [];
  const stray = scenarios.filter(scenario => !map.paths.some(path => path.id === scenario.pathId)).map(scenario => scenario.id);
  if (stray.length) {
    throw new Error(`Scenarios name a capability path that does not exist: ${stray.join(', ')}.`);
  }
  for (const path of map.paths) {
    const ids = scenarios.filter(scenario => scenario.pathId === path.id).map(scenario => scenario.id);
    path.scenarioIds = [...path.scenarioIds.filter(id => ids.includes(id)), ...ids.filter(id => !path.scenarioIds.includes(id))];
  }
  writeJson(file, map);
  return map.paths.map(path => `${path.id} ${path.title}: ${path.scenarioIds.length} ${path.scenarioIds.length === 1 ? 'scenario' : 'scenarios'}`).join('\n');
}
