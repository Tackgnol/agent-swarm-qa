import test from 'node:test';
import assert from 'node:assert/strict';
import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { main } from '../scripts/qa.ts';
import { closeCharter } from '../scripts/closing.ts';
import { loadLedger } from '../scripts/ledger.ts';
import { loadChart, saveChart } from '../scripts/wayfinding.ts';
import { approveBatch, lockSuite, readJson, readRun, startRun, writeJson } from '../scripts/workspace.ts';
import type { PathMap, Result, Scenario } from '../scripts/models.ts';
import { fixture } from './helpers.ts';

test('a write is recorded before it is made and the budget stops a lane instead of letting it overshoot', () => {
  const f = fixture();
  try {
    assert.match(main(['budget', f.root]), /0 of 20 draft writes spent/);
    assert.match(main(['budget', f.root, '2', 'draft']), /0 of 2 draft writes spent/);
    assert.match(main(['spend', f.root, 'lane-1', 'QA-001 creates a draft']), /Write 1 of 2/);
    main(['spend', f.root, 'lane-2', 'QA-002 creates a draft']);
    assert.throws(() => main(['spend', f.root, 'lane-1', 'one more']), /Write budget exhausted \(2 draft\)\. Stop/);
    assert.throws(() => main(['budget', f.root, '1', 'draft']), /cannot be set below/);
    assert.equal(loadLedger(f.root).writes.length, 2);
    assert.match(main(['fixture', f.root, 'draft-41', 'lane-1', 'QA-001 draft; delete button exists']), /1 test fixtures left/);
    assert.match(main(['fixture', f.root, 'draft-41', 'lane-1', 'Deleted and verified absent', 'done']), /0 test fixtures left/);
    assert.match(main(['map', f.root]), /2 of 2 draft writes spent; 0 test fixtures left/);
  } finally { rmSync(f.project, { recursive: true, force: true }); }
});

test('setup with writes allowed does not close until a write budget is agreed', () => {
  const f = fixture();
  try {
    rmSync(join(f.root, 'writes.json'));
    const chart = loadChart(f.root);
    chart.destination = 'Baseline.';
    saveChart(f.root, chart);
    assert.throws(() => closeCharter(f.root, 'setup', 'Confirmed.'), /agree a write budget/);
    assert.throws(() => main(['spend', f.root, 'lane-1', 'a write']), /No write budget is set/);
    main(['budget', f.root, '5', 'draft']);
    assert.match(closeCharter(f.root, 'setup', 'Confirmed.'), /Closed Set up the QA effort/);
    assert.match(main(['gist', f.root, 'setup', 'Confirmed: canary, 5 draft writes.']), /amended/);
    assert.equal(loadChart(f.root).charters[0].gist, 'Confirmed: canary, 5 draft writes.');
    assert.throws(() => main(['gist', f.root, 'find-routes', 'x']), /still open/);
  } finally { rmSync(f.project, { recursive: true, force: true }); }
});

test('starting a run and locking keep what the agent stored in the checkpoint', () => {
  const f = fixture();
  try {
    const file = join(f.root, 'checkpoint.json');
    writeJson(file, { ...readJson<object>(file), debt: ['one draft left on canary'], pendingQuestions: ['Is autosave intended?'] });
    startRun(f.root, 'canary', 'second', 'first-run');
    assert.deepEqual(readJson<{ debt: string[] }>(file).debt, ['one draft left on canary']);
    const result: Result = { scenarioId: 'QA-001', attempt: 1, status: 'failed', at: new Date().toISOString(), actual: 'The runner compared the wrong field.', browser: 'chromium', viewport: '1440x900', locale: 'en', boundary: 'Deployed UI plus real API persistence', screenshots: [], evidence: ['synthetic'] };
    const amended: Result = { ...result, attempt: 2, status: 'passed', actual: 'Attempt 1 executed correctly; its check read the wrong field. No re-execution.', resolution: { kind: 'check-corrected', reason: 'Replay would send a second real message.' } };
    writeJson(join(f.root, 'runs', 'second', 'results.json'), [result, amended]);
    assert.equal(readRun(f.root, 'second').results.length, 2);
    lockSuite(f.root, 'second', 'offline-lock');
    const after = readJson<{ debt: string[]; phase: string; pendingQuestions: string[] }>(file);
    assert.deepEqual([after.debt.length, after.phase, after.pendingQuestions.length], [1, 'locked', 1]);
  } finally { rmSync(f.project, { recursive: true, force: true }); }
});

test('draft scenarios are linted before approval and wired to their capability without hand-editing the map', () => {
  const f = fixture();
  try {
    assert.match(main(['lint-scenarios', f.root]), /QA-001 ok, with warnings · happy[\s\S]*no rule named[\s\S]*0 problems\./);
    const template = readJson<Scenario>(join(f.root, 'scenarios', 'QA-001.json'));
    const draft: Scenario = { ...template, id: 'QA-002', title: 'Deleting a run-owned draft removes it', approval: null, rule: 'Only the owner may edit the draft', operations: ['draft-editor/danger-zone/delete-draft/click', 'draft-editor/header/help-centre/click'] };
    writeJson(join(f.root, 'scenarios', 'QA-002.json'), draft);
    assert.throws(() => main(['lint-scenarios', f.root, 'QA-002']), /QA-002 PROBLEMS[\s\S]*help-centre\/click: only operated or deferred[\s\S]*delete-draft\/click is deferred: the run operates it[\s\S]*1 problem\./);
    draft.operations = ['draft-editor/danger-zone/delete-draft/click'];
    draft.rule = 'A rule nobody settled';
    writeJson(join(f.root, 'scenarios', 'QA-002.json'), draft);
    assert.match(main(['lint-scenarios', f.root, 'QA-002']), /does not match a rule of its capability word for word/);
    assert.match(main(['lint-scenarios', f.root]), /PATH-001 Owned draft editing: rules no scenario names yet:\n   - Only the owner may edit the draft\n   - Saved edits survive reload/);
    assert.throws(() => main(['lint-scenarios', f.root, 'QA-404']), /no such scenario file/);
    assert.match(main(['wire-scenarios', f.root]), /PATH-001 Owned draft editing: 2 scenarios/);
    assert.deepEqual(readJson<PathMap>(join(f.root, 'map.json')).paths[0].scenarioIds, ['QA-001', 'QA-002']);
    draft.rule = 'Only the owner may edit the draft';
    writeJson(join(f.root, 'scenarios', 'QA-002.json'), draft);
    approveBatch(f.root, 'offline-scope', ['PATH-001']);
    draft.pathId = 'PATH-404';
    writeJson(join(f.root, 'scenarios', 'QA-002.json'), draft);
    assert.throws(() => main(['wire-scenarios', f.root]), /does not exist: QA-002/);
  } finally { rmSync(f.project, { recursive: true, force: true }); }
});
