import test from 'node:test';
import assert from 'node:assert/strict';
import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { interactionsHash, loadInteractions, loadRoutes, resolveOperation } from '../scripts/interactions.ts';
import { approve, approveBatch, loadSuite, lockSuite, readJson, startRun, writeJson } from '../scripts/workspace.ts';
import type { Lock, PathMap, Result, RouteInteractions, RouteInventory, Run, Scenario } from '../scripts/models.ts';
import { fixture } from './helpers.ts';

function lockBaseline(root: string, runId: string): void {
  const result: Result = { scenarioId: 'QA-001', attempt: 1, status: 'passed', at: new Date().toISOString(), actual: 'Synthetic pass.', browser: 'chromium', viewport: '1440x900', locale: 'en', boundary: 'Deployed UI plus real API persistence', screenshots: [], evidence: ['synthetic'] };
  writeJson(join(root, 'runs', runId, 'results.json'), [result]);
  lockSuite(root, runId, 'offline-baseline-lock');
}

function addScenario(root: string, id: string, changes: Partial<Scenario>): void {
  const scenario = { ...readJson<Scenario>(join(root, 'scenarios', 'QA-001.json')), id, approval: null, ...changes };
  writeJson(join(root, 'scenarios', `${id}.json`), scenario);
  const map = readJson<PathMap>(join(root, 'map.json'));
  map.paths[0].scenarioIds.push(id);
  writeJson(join(root, 'map.json'), map);
}

test('interactions are addressed route/section/element/action and stored as Playwright locators', () => {
  const f = fixture();
  try {
    const interactions = loadInteractions(f.root);
    assert.equal(resolveOperation(interactions, 'draft-editor/header/title/fill').locator, "getByLabel('Title')");
    assert.throws(() => resolveOperation(interactions, 'draft-editor/header/title'), /route\/section\/element\/action/);
    assert.throws(() => resolveOperation(interactions, 'draft-editor/header/missing/click'), /no such interaction/);
    assert.throws(() => resolveOperation(interactions, 'draft-editor/danger-zone/delete-draft/click'), /only operated interactions/);
    const file = join(f.root, 'interactions', 'draft-editor.json');
    const entry = readJson<RouteInteractions>(file);
    const broken = structuredClone(entry);
    broken.interactions[0].locator = '#title';
    writeJson(file, broken);
    assert.throws(() => loadInteractions(f.root), /store a Playwright locator/);
    broken.interactions[0] = { ...entry.interactions[0], section: 'sidebar' };
    writeJson(file, broken);
    assert.throws(() => loadInteractions(f.root), /unknown section/);
    broken.interactions[0] = { ...entry.interactions[1] };
    writeJson(file, broken);
    assert.throws(() => loadInteractions(f.root), /Duplicate interaction draft-editor\/header\/share\/click/);
    broken.interactions[0] = { ...entry.interactions[0], effect: '' };
    writeJson(file, broken);
    assert.throws(() => loadInteractions(f.root), /record the observed effect/);
  } finally { rmSync(f.project, { recursive: true, force: true }); }
});

test('routes need a source, and a route that cannot be inventoried needs a reason', () => {
  const f = fixture();
  try {
    const file = join(f.root, 'routes.json');
    const routes = readJson<RouteInventory>(file);
    routes.routes[2].reason = '';
    writeJson(file, routes);
    assert.throws(() => loadRoutes(f.root), /admin-console is unreachable: record why/);
    routes.routes[2].reason = 'No admin identity.';
    routes.routes[0].sources = [];
    writeJson(file, routes);
    assert.throws(() => loadRoutes(f.root), /needs at least one source/);
    routes.routes[0].sources = ['source'];
    routes.routes.push({ ...routes.routes[0] });
    writeJson(file, routes);
    assert.throws(() => loadRoutes(f.root), /Duplicate route ID/);
  } finally { rmSync(f.project, { recursive: true, force: true }); }
});

test('operating knowledge is agent-owned: changing it keeps the approval but an unresolvable operation stops the run', () => {
  const f = fixture();
  try {
    const before = loadSuite(f.root).hash;
    const file = join(f.root, 'scenarios', 'QA-001.json');
    const scenario = readJson<Scenario>(file);
    scenario.operations = ['draft-editor/header/title/fill', 'draft-editor/header/share/click'];
    writeJson(file, scenario);
    const map = readJson<PathMap>(join(f.root, 'map.json'));
    map.paths[0].routes = ['draft-editor', 'sign-up'];
    writeJson(join(f.root, 'map.json'), map);
    assert.equal(loadSuite(f.root).hash, before);
    assert.ok(startRun(f.root, 'canary', 'relinked', 'first-run'));
    scenario.operations = ['draft-editor/danger-zone/delete-draft/click'];
    writeJson(file, scenario);
    assert.throws(() => startRun(f.root, 'canary', 'skipped-operation', 'first-run'), /only operated interactions/);
  } finally { rmSync(f.project, { recursive: true, force: true }); }
});

test('error and adversarial tiers wait for a locked baseline, and an adversarial scenario names its rule', () => {
  const f = fixture();
  try {
    addScenario(f.root, 'QA-002', { title: 'A stranger cannot open the draft', tier: 'error', rule: 'Only the owner may edit the draft' });
    approveBatch(f.root, 'offline-error-scope', ['PATH-001']);
    assert.throws(() => startRun(f.root, 'canary', 'too-early', 'first-run'), /Lock the happy-path baseline/);
    const map = readJson<PathMap>(join(f.root, 'map.json'));
    map.paths[0].scenarioIds = ['QA-001'];
    writeJson(join(f.root, 'map.json'), map);
    rmSync(join(f.root, 'scenarios', 'QA-002.json'));
    approve(f.root, 'path:PATH-001', 'offline-back-to-baseline');
    startRun(f.root, 'canary', 'baseline', 'first-run');
    lockBaseline(f.root, 'baseline');
    assert.deepEqual(readJson<Lock>(join(f.root, 'locked.json')).tiers, { happy: 1, error: 0, adversarial: 0 });

    addScenario(f.root, 'QA-002', { title: 'A stranger cannot open the draft', tier: 'error', rule: 'Only the owner may edit the draft' });
    addScenario(f.root, 'QA-003', { title: 'Two tabs save conflicting titles', tier: 'adversarial' });
    assert.throws(() => approveBatch(f.root, 'offline-layer-scope', ['PATH-001']), /name the rule it tries to break/);
    const attack = readJson<Scenario>(join(f.root, 'scenarios', 'QA-003.json'));
    attack.rule = 'Saved edits survive reload';
    writeJson(join(f.root, 'scenarios', 'QA-003.json'), attack);
    approveBatch(f.root, 'offline-layer-scope', ['PATH-001']);
    const layered = startRun(f.root, 'canary', 'layers', 'first-run');
    writeJson(join(layered, 'results.json'), ['QA-001', 'QA-002', 'QA-003'].map(scenarioId => ({ scenarioId, attempt: 1, status: 'passed', at: new Date().toISOString(), actual: 'Synthetic.', browser: 'chromium', viewport: '1440x900', locale: 'en', boundary: 'Deployed UI plus real API persistence', screenshots: [], evidence: ['synthetic'] })));
    lockSuite(f.root, 'layers', 'offline-layer-lock');
    assert.deepEqual(readJson<Lock>(join(f.root, 'locked.json')).tiers, { happy: 1, error: 1, adversarial: 1 });
    const bad = readJson<Scenario>(join(f.root, 'scenarios', 'QA-002.json'));
    (bad as { tier: string }).tier = 'chaos';
    writeJson(join(f.root, 'scenarios', 'QA-002.json'), bad);
    approve(f.root, 'QA-002', 'offline-unknown-tier');
    assert.throws(() => loadSuite(f.root), /unknown tier/);
  } finally { rmSync(f.project, { recursive: true, force: true }); }
});

test('a retest notes interaction-map drift since the lock instead of blaming the product', () => {
  const f = fixture();
  try {
    lockBaseline(f.root, 'first');
    const locked = readJson<Lock>(join(f.root, 'locked.json'));
    assert.equal(locked.interactionsHash, interactionsHash(f.root));
    const same = readJson<Run>(join(startRun(f.root, 'canary', 'same-map', 'retest'), 'run.json'));
    assert.deepEqual(same.limits, []);
    const file = join(f.root, 'interactions', 'draft-editor.json');
    const entry = readJson<RouteInteractions>(file);
    entry.capturedAt = new Date().toISOString();
    writeJson(file, entry);
    assert.equal(interactionsHash(f.root), locked.interactionsHash);
    entry.interactions[0].locator = "getByRole('textbox', { name: 'Draft title' })";
    writeJson(file, entry);
    const drifted = readJson<Run>(join(startRun(f.root, 'canary', 'drifted-map', 'retest'), 'run.json'));
    assert.match(drifted.limits[0], /interaction map changed since the lock/);
    assert.notEqual(drifted.interactionsHash, locked.interactionsHash);
  } finally { rmSync(f.project, { recursive: true, force: true }); }
});
