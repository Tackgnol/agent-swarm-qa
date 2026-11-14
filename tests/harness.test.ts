import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { main } from '../scripts/qa.ts';
import { loadLedger } from '../scripts/ledger.ts';
import { readRun, writeJson } from '../scripts/workspace.ts';
import type { Result } from '../scripts/models.ts';
import { fixture, repo } from './helpers.ts';

const qa = createRequire(import.meta.url)(join(repo, 'scripts', 'harness.cjs'));
const boundary = 'Deployed UI plus real API persistence';

test('attempts are appended, runner crashes are logged apart, and the lane results load as a run', () => {
  const f = fixture();
  try {
    const lane = join(f.run, 'lanes', 'lane-1');
    qa.runnerError(lane, 'QA-001', 'TypeError: wrong locator in the runner');
    assert.equal(qa.nextAttempt(lane, 'QA-001'), 1);
    const first = qa.record(lane, { scenarioId: 'QA-001', status: 'failed', actual: 'The title reverted after reload.', viewport: '1440x900', boundary, evidence: ['PUT /api/drafts/:id 200'] });
    const second = qa.record(lane, { scenarioId: 'QA-001', status: 'passed', actual: 'The title was kept after reload.', viewport: '1440x900', boundary, evidence: ['GET /api/drafts/:id 200'], resolution: { kind: 'harness-corrected', reason: 'Attempt 1 reloaded before the save settled.' } });
    assert.deepEqual([first.attempt, second.attempt], [1, 2]);
    assert.throws(() => qa.record(lane, { scenarioId: 'QA-001', status: 'green', actual: 'x', viewport: '1440x900', boundary }), /Unknown status/);
    assert.throws(() => qa.record(lane, { scenarioId: 'QA-001', status: 'passed', actual: ' ', viewport: '1440x900', boundary }), /what was actually observed/);
    assert.equal(JSON.parse(readFileSync(join(lane, 'harness-log.json'), 'utf8')).length, 1);
    writeJson(join(f.run, 'results.json'), JSON.parse(readFileSync(join(lane, 'results.json'), 'utf8')) as Result[]);
    assert.equal(readRun(f.root, 'first').results.length, 2);
  } finally { rmSync(f.project, { recursive: true, force: true }); }
});

test('the harness spends from the shared budget, records fixtures and refuses once the budget is gone', () => {
  const f = fixture();
  try {
    main(['budget', f.root, '1', 'draft']);
    assert.match(qa.spend(f.root, 'lane-1', 'QA-001 creates a draft'), /Write 1 of 1/);
    assert.throws(() => qa.spend(f.root, 'lane-1', 'QA-001 creates another draft'), /Write budget exhausted/);
    assert.match(qa.fixture(f.root, 'draft-7', 'lane-1', 'QA-001 draft left on canary', 'handed-off'), /1 test fixtures left/);
    assert.equal(loadLedger(f.root).fixtures[0].cleanup, 'handed-off');
  } finally { rmSync(f.project, { recursive: true, force: true }); }
});

test('a send-once step is guarded across replays and evidence carries patterns, not ids', () => {
  const f = fixture();
  try {
    const lane = join(f.run, 'lanes', 'lane-2');
    assert.equal(qa.once(lane, 'QA-009-send'), true);
    assert.equal(qa.once(lane, 'QA-009-send'), false);
    assert.ok(existsSync(join(lane, 'QA-009-send.done')));
    assert.equal(qa.mask('/api/drafts/4b5cb22d-cb6d-41a8-b6b6-d8e537711b45/items/12345'), '/api/drafts/:id/items/:id');
  } finally { rmSync(f.project, { recursive: true, force: true }); }
});

test('the request log separates API calls, writes, trouble and third-party hosts', () => {
  const page = new EventEmitter();
  const log = qa.track(page, { baseUrl: 'https://app.example.test' });
  const response = (method: string, url: string, status: number) => ({ url: () => url, status: () => status, request: () => ({ method: () => method }) });
  page.emit('request', { url: () => 'https://www.googletagmanager.com/gtag/js' });
  page.emit('requestfailed', { url: () => 'https://fonts.example.test/a.woff2' });
  page.emit('response', response('GET', 'https://app.example.test/api/drafts/123456', 200));
  page.emit('response', response('PUT', 'https://app.example.test/api/drafts/123456', 502));
  page.emit('response', response('GET', 'https://app.example.test/assets/main.js', 200));
  page.emit('response', response('POST', 'https://other.example.test/api/track', 200));
  assert.deepEqual(log.since(), ['GET /api/drafts/:id 200', 'PUT /api/drafts/:id 502']);
  assert.deepEqual(log.writes(), ['PUT /api/drafts/:id 502']);
  assert.deepEqual(log.trouble(), ['PUT /api/drafts/:id 502']);
  assert.deepEqual([...log.hosts], ['www.googletagmanager.com']);
  assert.deepEqual([...log.failedHosts], ['fonts.example.test']);
});

test('stored locators resolve only as Playwright locator calls, and section readings are compared by section', () => {
  const calls: string[] = [];
  const base = new Proxy({}, { get: (_target, name) => (...args: unknown[]) => { calls.push(`${String(name)}(${JSON.stringify(args)})`); return base; } });
  qa.locate(base, "getByRole('region', { name: 'Gear' })");
  qa.locate(base, "getByTestId('draft').getByRole('list')");
  assert.deepEqual(calls, ['getByRole(["region",{"name":"Gear"}])', 'getByTestId(["draft"])', 'getByRole(["list"])']);
  for (const hostile of ["getByRole('x'); process.exit(1)", "getByText(require('fs'))", "page.goto('x')", "getByRole(() => 1)"]) {
    assert.throws(() => qa.locate(base, hostile), /Not a stored Playwright locator/);
  }
  assert.deepEqual(qa.changedSections({ title: 'Draft 3', tags: 'news' }, { title: 'Draft 4', tags: 'news' }), ['title']);
  assert.deepEqual(qa.changedSections({ title: 'a' }, { title: 'a', tags: 'sport' }), ['tags']);
});
