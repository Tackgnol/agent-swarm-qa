import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { approve, approveBatch, focusReviewPath, loadSuite, nextPathId, readJson, reviewPath, writeJson } from '../scripts/workspace.ts';
import { main } from '../scripts/qa.ts';
import type { PathMap, Scenario } from '../scripts/models.ts';
import { fixture } from './helpers.ts';

function withPendingPaths(): ReturnType<typeof fixture> {
  const f = fixture();
  const map = readJson<PathMap>(join(f.root, 'map.json'));
  const template = readJson<Scenario>(join(f.root, 'scenarios', 'QA-001.json'));
  // Deliberately shuffled input checks the review queue rather than array/lexical order.
  for (const number of [31, 9, 8, ...Array.from({ length: 29 }, (_, index) => index + 2).filter(number => ![8, 9].includes(number))]) {
    const suffix = String(number).padStart(3, '0');
    const id = `PATH-${suffix}`;
    const scenarioId = `QA-${suffix}`;
    map.paths.push({ id, title: `Journey ${number}`, route: `/journey/${number}`, scenarioIds: [scenarioId], disposition: 'included', reason: 'Offline review fixture', approval: null });
    writeJson(join(f.root, 'scenarios', `${scenarioId}.json`), { ...template, id: scenarioId, pathId: id, approval: null });
  }
  writeJson(join(f.root, 'map.json'), map);
  for (let number = 2; number <= 7; number += 1) {
    const suffix = String(number).padStart(3, '0');
    approve(f.root, `path:PATH-${suffix}`, 'offline-prior-reviewed-path');
    approve(f.root, `QA-${suffix}`, 'offline-prior-reviewed-scenario');
  }
  return f;
}

test('review stays on PATH-008 through its scenario and then advances to PATH-009', () => {
  const f = withPendingPaths();
  try {
    assert.equal(reviewPath(f.root).currentPathId, 'PATH-008');
    assert.throws(() => approve(f.root, 'path:PATH-031', 'offline-unrequested-jump'), /Review PATH-008 first/);
    assert.throws(() => approve(f.root, 'QA-031', 'offline-unrequested-jump'), /Review PATH-008 first/);
    approve(f.root, 'path:PATH-008', 'offline-path-answer');
    assert.equal(reviewPath(f.root).currentPathId, 'PATH-008');
    approve(f.root, 'QA-008', 'offline-scenario-answer');
    assert.equal(reviewPath(f.root).currentPathId, 'PATH-009');
    assert.deepEqual(reviewPath(f.root).order, Array.from({ length: 31 }, (_, index) => `PATH-${String(index + 1).padStart(3, '0')}`));
  } finally { rmSync(f.project, { recursive: true, force: true }); }
});

test('an explicit reasoned jump returns to unfinished earlier work after completion', () => {
  const f = withPendingPaths();
  try {
    assert.throws(() => focusReviewPath(f.root, 'PATH-031', 'offline-user-request', ''), /reason/);
    assert.equal(focusReviewPath(f.root, 'PATH-031', 'offline-user-request', 'Review the host dependency first').currentPathId, 'PATH-031');
    assert.equal(reviewPath(f.root).jumps[0].from, 'PATH-008');
    approve(f.root, 'path:PATH-031', 'offline-user-request');
    approve(f.root, 'QA-031', 'offline-user-request');
    assert.equal(reviewPath(f.root).currentPathId, 'PATH-008');
    assert.equal(reviewPath(f.root).overridePathId, null);
  } finally { rmSync(f.project, { recursive: true, force: true }); }
});

test('cursor survives shuffled map writes, forbids disappearing IDs and appends discovery numbers', () => {
  const f = withPendingPaths();
  try {
    assert.equal(nextPathId(f.root), 'PATH-032');
    const map = readJson<PathMap>(join(f.root, 'map.json'));
    map.paths.reverse();
    writeJson(join(f.root, 'map.json'), map);
    assert.equal(reviewPath(f.root).currentPathId, 'PATH-008');
    const full = structuredClone(map);
    map.paths = map.paths.filter(path => path.id !== 'PATH-008');
    writeJson(join(f.root, 'map.json'), map);
    assert.throws(() => reviewPath(f.root), /path ID disappeared/);
    full.paths.push({ id: 'PATH-033', title: 'Skipped allocation', route: '/new', scenarioIds: [], disposition: 'pending', reason: '', approval: null });
    writeJson(join(f.root, 'map.json'), full);
    assert.throws(() => reviewPath(f.root), /skip numbers/);
  } finally { rmSync(f.project, { recursive: true, force: true }); }
});

test('editing an earlier approved scenario returns it to the review frontier', () => {
  const f = withPendingPaths();
  try {
    reviewPath(f.root);
    const scenario = readJson<Scenario>(join(f.root, 'scenarios', 'QA-001.json'));
    scenario.expected.push('A newly proposed behavior');
    writeJson(join(f.root, 'scenarios', 'QA-001.json'), scenario);
    assert.equal(reviewPath(f.root).currentPathId, 'PATH-001');
    assert.throws(() => approve(f.root, 'path:PATH-008', 'offline-unrequested-jump'), /Review PATH-001 first/);
  } finally { rmSync(f.project, { recursive: true, force: true }); }
});

test('one scope confirmation records a large derived batch and preserves prior decisions', () => {
  const f = withPendingPaths();
  try {
    const map = readJson<PathMap>(join(f.root, 'map.json'));
    const path = map.paths.find(entry => entry.id === 'PATH-008')!;
    path.intent = { goal: 'Members manage durable character state', rules: ['Ownership controls editing', 'Saved values survive reload'], risks: ['Lost work', 'Unauthorized edits'] };
    const template = readJson<Scenario>(join(f.root, 'scenarios', 'QA-008.json'));
    for (let number = 32; number <= 140; number += 1) {
      const id = `QA-${String(number).padStart(3, '0')}`;
      path.scenarioIds.push(id);
      writeJson(join(f.root, 'scenarios', `${id}.json`), { ...template, id, approval: null });
    }
    writeJson(join(f.root, 'map.json'), map);
    const pending = reviewPath(f.root).pendingPathIds;
    const cursor = JSON.parse(main(['approve-batch', f.root, 'offline-one-displayed-scope-confirmation', ...pending]));
    assert.equal(cursor.currentPathId, null);
    const suite = loadSuite(f.root);
    assert.equal(suite.scenarios.length, 140);
    assert.equal(suite.scenarios.find(entry => entry.id === 'QA-140')!.approval!.decisionRef, 'offline-one-displayed-scope-confirmation');
    assert.equal(suite.scenarios.find(entry => entry.id === 'QA-001')!.approval!.decisionRef, 'offline-test-fixture');
    assert.equal(suite.map.paths.find(entry => entry.id === 'PATH-007')!.approval!.decisionRef, 'offline-prior-reviewed-path');
    const hash = suite.hash;
    approveBatch(f.root, 'offline-repeated-confirmation', pending);
    assert.equal(loadSuite(f.root).hash, hash);
    assert.equal(loadSuite(f.root).scenarios.find(entry => entry.id === 'QA-140')!.approval!.decisionRef, 'offline-one-displayed-scope-confirmation');
    path.intent.rules.push('A new proposed editing permission');
    // Preserve the just-recorded approvals while changing only the feature rule.
    const changed = readJson<PathMap>(join(f.root, 'map.json'));
    changed.paths.find(entry => entry.id === path.id)!.intent = path.intent;
    writeJson(join(f.root, 'map.json'), changed);
    assert.equal(reviewPath(f.root).currentPathId, 'PATH-008');
    assert.throws(() => loadSuite(f.root), /reviewed disposition/);
  } finally { rmSync(f.project, { recursive: true, force: true }); }
});

test('batch preflight rejects skipped paths or malformed later cases without partial approval', () => {
  const f = withPendingPaths();
  try {
    const mapFile = join(f.root, 'map.json');
    const caseFile = join(f.root, 'scenarios', 'QA-008.json');
    const originalMap = readFileSync(mapFile, 'utf8');
    const originalCase = readFileSync(caseFile, 'utf8');
    assert.throws(() => approveBatch(f.root, '', ['PATH-008']), /actual user/);
    assert.throws(() => approveBatch(f.root, 'offline', ['PATH-008', 'PATH-008']), /once/);
    assert.throws(() => approveBatch(f.root, 'offline', ['PATH-008', 'PATH-010']), /frontier/);
    assert.throws(() => approveBatch(f.root, 'offline', ['PATH-009', 'PATH-008']), /frontier/);
    assert.throws(() => approveBatch(f.root, 'offline', ['PATH-UNKNOWN']), /Unknown/);
    const laterFile = join(f.root, 'scenarios', 'QA-009.json');
    const later = readJson<Scenario>(laterFile);
    later.pathId = 'PATH-008';
    writeJson(laterFile, later);
    assert.throws(() => approveBatch(f.root, 'offline-displayed-batch', ['PATH-008', 'PATH-009']), /belong/);
    assert.equal(readFileSync(mapFile, 'utf8'), originalMap);
    assert.equal(readFileSync(caseFile, 'utf8'), originalCase);
    assert.equal(reviewPath(f.root).currentPathId, 'PATH-008');
  } finally { rmSync(f.project, { recursive: true, force: true }); }
});

test('a focused capability batch returns to the earlier unfinished frontier', () => {
  const f = withPendingPaths();
  try {
    focusReviewPath(f.root, 'PATH-031', 'offline-priority-request', 'Resolve the host capability first');
    const cursor = approveBatch(f.root, 'offline-host-scope-confirmation', ['PATH-031']);
    assert.equal(cursor.currentPathId, 'PATH-008');
    assert.equal(cursor.overridePathId, null);
    assert.equal(cursor.jumps.length, 1);
  } finally { rmSync(f.project, { recursive: true, force: true }); }
});
