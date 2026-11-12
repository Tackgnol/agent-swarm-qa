import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { inventoryGaps, loadRoutes } from './interactions.ts';
import { readJson, safeId } from './store.ts';
import { loadChart, saveChart } from './wayfinding.ts';
import { hasApproval, loadSuite, readRun } from './workspace.ts';
import type { Chart, Charter, Config, Lock, PathMap, Scenario } from './models.ts';

function capabilityGaps(root: string, charter: Charter): string[] {
  const map = readJson<PathMap>(join(root, 'map.json'));
  return charter.subjects!.flatMap(id => {
    const path = map.paths.find(entry => entry.id === id);
    if (!path) {
      return [`${id} is not in map.json.`];
    }
    if (path.disposition === 'excluded') {
      return path.reason.trim() ? [] : [`${path.title} is excluded without a reason.`];
    }
    if (charter.kind === 'intent') {
      return path.intent?.goal?.trim() && path.intent.rules.length > 0 ? [] : [`${path.title} needs a settled goal and at least one rule.`];
    }
    const tier = charter.tier ?? 'happy';
    const scenarios = path.scenarioIds.map(scenarioId => join(root, 'scenarios', `${safeId(scenarioId)}.json`)).filter(existsSync).map(file => readJson<Scenario>(file));
    const gaps: string[] = [];
    if (scenarios.length !== path.scenarioIds.length) {
      gaps.push(`${path.title} lists scenarios that have no file.`);
    }
    if (!scenarios.some(scenario => (scenario.tier ?? 'happy') === tier)) {
      gaps.push(`${path.title} has no ${tier}-tier scenario.`);
    }
    const unconfirmed = scenarios.filter(scenario => !hasApproval(scenario, scenario.approval)).map(scenario => scenario.title);
    if (!hasApproval(path, path.approval) || unconfirmed.length) {
      gaps.push(`${path.title} lacks a current scope confirmation${unconfirmed.length ? ` for: ${unconfirmed.join('; ')}` : ''}.`);
    }
    return gaps;
  });
}

/** What still stands between a charter and its completion criterion. Empty means it may close. */
export function completionGaps(root: string, chart: Chart, charter: Charter): string[] {
  switch (charter.kind) {
    case 'setup': {
      const config = readJson<Config>(join(root, 'config.json'));
      return [
        ...(chart.destination.trim() ? [] : ['Name the destination in charters.json.']),
        ...(hasApproval(config, config.setupApproval) ? [] : ['Setup needs the user\'s current confirmation (qa.ts approve <qa-root> setup <decision-ref>).']),
      ];
    }
    case 'routes': {
      const routes = loadRoutes(root).routes;
      const chartered = new Set(chart.charters.filter(item => item.kind === 'inventory').flatMap(item => item.subjects ?? []));
      const missing = routes.filter(route => route.status === 'pending' && !chartered.has(route.id)).map(route => route.id);
      return [
        ...(routes.length ? [] : ['routes.json lists no routes.']),
        ...(missing.length ? [`Pending routes without an inventory charter: ${missing.join(', ')}.`] : []),
      ];
    }
    case 'inventory': {
      const routes = loadRoutes(root).routes;
      return charter.subjects!.flatMap(id => {
        const route = routes.find(entry => entry.id === id);
        return route ? inventoryGaps(root, route) : [`${id} is not in routes.json.`];
      });
    }
    case 'intent':
    case 'scenarios':
      return capabilityGaps(root, charter);
    case 'run':
      return charter.subjects!.flatMap(id => {
        if (!existsSync(join(root, 'runs', safeId(id), 'run.json'))) {
          return [`Run ${id} does not exist.`];
        }
        const { directory, suite, run, results } = readRun(root, id);
        const silent = suite.scenarios.filter(scenario => !results.some(result => result.scenarioId === scenario.id)).map(scenario => scenario.title);
        return [
          ...(!run.observedBuild.trim() || run.observedBuild.trim().toLowerCase() === 'unverified' ? [`Run ${id}: record the observed build.`] : []),
          ...(silent.length ? [`Run ${id} has no recorded disposition for: ${silent.join('; ')}.`] : []),
          ...(existsSync(join(directory, 'report.json')) ? [] : [`Run ${id}: render the report (qa.ts report <qa-root> ${id}).`]),
        ];
      });
    case 'lock': {
      const file = join(root, 'locked.json');
      if (!existsSync(file)) {
        return ['Nothing is locked yet (qa.ts lock <qa-root> <run-id> <decision-ref>).'];
      }
      return readJson<Lock>(file).suiteHash === loadSuite(root).hash ? [] : ['The suite changed after the lock: run it under scrutiny and lock again.'];
    }
    case 'task':
      return [];
  }
}

/** Close a charter only against its criterion; the gist is the single line the map keeps. */
export function closeCharter(root: string, id: string, gist: string): string {
  const chart = loadChart(root);
  const charter = chart.charters.find(item => item.id === id);
  assert.ok(charter, `Unknown charter ${id}.`);
  assert.ok(charter.status === 'open', `${charter.name} is already ${charter.status}.`);
  assert.ok(gist.trim() && !gist.includes('\n'), 'Record a one-line gist of the outcome; the detail stays in the artifact the charter produced.');
  const waiting = charter.blockedBy.filter(blocker => chart.charters.find(item => item.id === blocker)!.status === 'open');
  assert.ok(waiting.length === 0, `${charter.name} still waits on: ${waiting.join(', ')}.`);
  const gaps = completionGaps(root, chart, charter);
  assert.ok(gaps.length === 0, `${charter.name} is not done:\n- ${gaps.join('\n- ')}`);
  charter.status = 'closed';
  charter.claimedBy = null;
  charter.gist = gist.trim();
  saveChart(root, chart);
  return `Closed ${charter.name}. Graduate what this made specifiable into charters, clear the fog lines they replace, then run qa.ts map <qa-root>.`;
}
