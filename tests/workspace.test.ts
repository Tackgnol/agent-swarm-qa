import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { approvalHash, approve, inside, initialize, loadSuite, lockSuite, readJson, startRun, writeJson } from '../scripts/workspace.ts';
import type { Config, PathMap, Result, Run, Scenario } from '../scripts/models.ts';
import { fixture } from './helpers.ts';

test('init leaves credentials private, creates a resume checkpoint and refuses overwrite', () => {
  const f = fixture();
  try {
    writeFileSync(join(f.root, '.env.qa'), 'QA_OWNER_PASSWORD=synthetic-only\n');
    assert.throws(() => initialize(f.project, 'example'), /already exists/);
    assert.equal(readFileSync(join(f.root, '.env.qa'), 'utf8'), 'QA_OWNER_PASSWORD=synthetic-only\n');
    assert.equal(readFileSync(join(f.root, '.gitignore'), 'utf8'), '*\n!.gitignore\n');
    assert.ok(existsSync(join(f.root, 'checkpoint.json')));
    assert.throws(() => initialize(f.project, '../../outside'));
  } finally { rmSync(f.project, { recursive: true, force: true }); }
});

test('scenario edits invalidate approval and cannot enter a run until the user reapproves', () => {
  const f = fixture();
  try {
    const path = join(f.root, 'scenarios', 'QA-001.json');
    const scenario = readJson<Scenario>(path);
    scenario.expected.push('A newly agreed expectation');
    writeJson(path, scenario);
    assert.throws(() => startRun(f.root, 'canary', 'changed', 'first-run'), /current user approval/);
    approve(f.root, 'QA-001', 'offline-reapproval');
    assert.ok(loadSuite(f.root).hash);
    assert.throws(() => lockSuite(f.root, 'first', 'offline-lock'), /revised suite/);
  } finally { rmSync(f.project, { recursive: true, force: true }); }
});

test('mapping and setup changes invalidate their own approvals', () => {
  const f = fixture();
  try {
    const config = readJson<Config>(join(f.root, 'config.json'));
    config.environments[0].appUrl = 'https://changed.example.test';
    writeJson(join(f.root, 'config.json'), config);
    assert.throws(() => loadSuite(f.root), /Setup needs/);
    approve(f.root, 'setup', 'offline-setup-change');
    const map = readJson<PathMap>(join(f.root, 'map.json'));
    map.paths[0].route = '/new-path';
    writeJson(join(f.root, 'map.json'), map);
    assert.throws(() => loadSuite(f.root), /reviewed disposition/);
  } finally { rmSync(f.project, { recursive: true, force: true }); }
});

test('lock requires resolved questions and all dispositions, then retest checks the fingerprint', () => {
  const f = fixture();
  try {
    assert.throws(() => lockSuite(f.root, 'first', 'offline-lock'), /Every scenario/);
    const result: Result = { scenarioId: 'QA-001', attempt: 1, status: 'failed', at: new Date().toISOString(), actual: 'Synthetic save failed', browser: 'chromium', viewport: '1440x900', locale: 'en', boundary: 'offline fixture', screenshots: [], evidence: [] };
    writeJson(join(f.run, 'results.json'), [result]);
    const run = readJson<Run>(join(f.run, 'run.json'));
    run.openQuestions.push('Which behavior is intended?');
    writeJson(join(f.run, 'run.json'), run);
    assert.throws(() => lockSuite(f.root, 'first', 'offline-lock'), /open specification/);
    run.openQuestions = [];
    writeJson(join(f.run, 'run.json'), run);
    lockSuite(f.root, 'first', 'offline-user-locks-known-failure');
    assert.ok(startRun(f.root, 'canary', 'second', 'retest'));
    const config = readJson<Config>(join(f.root, 'config.json'));
    config.coverage.browsers.push('firefox');
    writeJson(join(f.root, 'config.json'), config);
    approve(f.root, 'setup', 'offline-browser-change');
    assert.throws(() => startRun(f.root, 'canary', 'third', 'retest'), /Suite changed/);
    assert.throws(() => startRun(f.root, 'canary', 'second', 'first-run'), /already exists/);
  } finally { rmSync(f.project, { recursive: true, force: true }); }
});

test('workspace paths cannot escape to sibling directories', () => {
  assert.throws(() => inside('/safe/qa', '../private'));
  assert.throws(() => inside('/safe/qa', '/elsewhere'));
});

test('reconfirming unchanged content does not invalidate the contract fingerprint', () => {
  const f = fixture();
  try {
    const before = loadSuite(f.root).hash;
    approve(f.root, 'setup', 'offline-second-confirmation');
    approve(f.root, 'path:PATH-001', 'offline-second-confirmation');
    approve(f.root, 'QA-001', 'offline-second-confirmation');
    assert.equal(loadSuite(f.root).hash, before);
  } finally { rmSync(f.project, { recursive: true, force: true }); }
});

test('a host endpoint selects either its public URL or its private key reference', () => {
  const f = fixture();
  try {
    const config = readJson<Config>(join(f.root, 'config.json'));
    config.environments[0].hostUrlEnv = 'OWLBEAR_URL';
    config.environments[0].hostUrl = 'https://host.example.test';
    writeJson(join(f.root, 'config.json'), config);
    approve(f.root, 'setup', 'offline-conflicting-targets');
    assert.throws(() => loadSuite(f.root), /public host URL or a private host env reference/);
    delete config.environments[0].hostUrl;
    writeJson(join(f.root, 'config.json'), config);
    approve(f.root, 'setup', 'offline-private-target');
    assert.ok(loadSuite(f.root).hash);
  } finally { rmSync(f.project, { recursive: true, force: true }); }
});

test('a workspace can live outside the product; the product path is recorded and stays outside the setup approval', async () => {
  const { mkdtempSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { createRequire } = await import('node:module');
  const product = mkdtempSync(join(tmpdir(), 'swarm-qa-product-'));
  const elsewhere = mkdtempSync(join(tmpdir(), 'swarm-qa-elsewhere-'));
  try {
    const root = initialize(product, 'outside', elsewhere);
    assert.equal(root, join(elsewhere, '.scratch', 'QA', 'outside'));
    const config = readJson<Config>(join(root, 'config.json'));
    assert.equal(config.productRoot, product);
    assert.ok(existsSync(join(root, 'private')) && existsSync(join(root, 'runners', 'lib', 'app.cjs')));
    const app = createRequire(import.meta.url)(join(root, 'runners', 'lib', 'app.cjs'));
    assert.equal(app.QA_ROOT, root);
    await assert.rejects(() => app.signIn(null, 'owner'), /signIn\(owner\) is not written yet/);
    approve(root, 'setup', 'offline-setup');
    const moved = readJson<Config>(join(root, 'config.json'));
    moved.productRoot = '/somewhere/else';
    writeJson(join(root, 'config.json'), moved);
    assert.ok(approvalHash(moved) === readJson<Config>(join(root, 'config.json')).setupApproval!.contentHash);
    assert.equal(initialize(product, 'inside'), join(product, '.scratch', 'QA', 'inside'));
    assert.equal(readJson<Config>(join(product, '.scratch', 'QA', 'inside', 'config.json')).productRoot, undefined);
    assert.throws(() => initialize(product, 'nowhere', join(elsewhere, 'missing')), /existing directory for the workspace/);
  } finally {
    rmSync(product, { recursive: true, force: true });
    rmSync(elsewhere, { recursive: true, force: true });
  }
});
