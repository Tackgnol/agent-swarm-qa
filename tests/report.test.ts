import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { approve, readJson, readRun, startRun, writeJson } from '../scripts/workspace.ts';
import { buildReport, renderHtml, renderMarkdown, writeReport, writePlanningReport } from '../scripts/report.ts';
import type { Config, Report, Result, Scenario } from '../scripts/models.ts';
import { fixture } from './helpers.ts';

function outcome(status: Result['status'], attempt = 1): Result {
  return { scenarioId: 'QA-001', attempt, status, at: new Date().toISOString(), actual: 'Synthetic observation', browser: 'chromium', viewport: '390x844', locale: 'en', boundary: 'Deployed UI plus real API persistence', screenshots: [], evidence: ['Synthetic assertion fixture for the report test'] };
}

test('partial runs retain missing cases and unknown build instead of reporting success', () => {
  const f = fixture();
  try {
    const htmlPath = writeReport(f.root, 'first');
    const report = readJson<Report>(join(f.run, 'report.json'));
    assert.equal(report.counts['not-run'], 1);
    assert.equal(report.recommendation, 'readiness-unproven');
    assert.ok(readFileSync(htmlPath, 'utf8').includes('Not run.'));
    const planningPath = writePlanningReport(f.root);
    assert.ok(readFileSync(planningPath, 'utf8').includes('planning'));
    writeJson(join(f.root, 'checkpoint.json'), { phase: 'init', pendingQuestions: ['Which identity paths should be covered?', 'Where should issues live?'] });
    writePlanningReport(f.root);
    const planning = readJson<Report>(join(f.root, 'planning', 'report.json'));
    assert.deepEqual(planning.run.openQuestions, ['Which identity paths should be covered?', 'Where should issues live?']);
    assert.ok(readFileSync(join(f.root, 'planning', 'report.md'), 'utf8').includes('## Evidence'));
  } finally { rmSync(f.project, { recursive: true, force: true }); }
});

test('capability briefs summarize large execution gaps while retaining every detailed case', () => {
  const f = fixture();
  try {
    const { suite, run } = readRun(f.root, 'first');
    suite.map.paths[0].intent = { goal: 'Keep <owner> edits durable', rules: ['Saved edits survive reload'], risks: ['Silent loss of work'] };
    for (let number = 2; number <= 140; number += 1) {
      const id = `QA-${String(number).padStart(3, '0')}`;
      suite.map.paths[0].scenarioIds.push(id);
      suite.scenarios.push({ ...suite.scenarios[0], id });
    }
    const report = buildReport(suite, run, []);
    assert.equal(report.recommendation, 'readiness-unproven');
    assert.equal(report.counts['not-run'], 140);
    const gapReason = report.reasons.find(reason => reason.startsWith('Critical coverage'))!;
    assert.ok(gapReason.includes('140 scenarios across 1 path'));
    assert.ok(gapReason.length < 250);
    const markup = renderHtml(report, f.run);
    assert.ok(markup.includes('id="path-PATH-001"'));
    assert.ok(markup.includes('Keep &lt;owner&gt; edits durable'));
    assert.ok(markup.includes('Saved edits survive reload'));
    assert.ok(markup.includes('0/140 cases passed'));
    assert.ok(renderMarkdown(report).includes('Silent loss of work'));
    for (const scenario of suite.scenarios) {
      assert.ok(markup.includes(`href="#case-${scenario.id}"`));
      assert.ok(markup.includes(`id="case-${scenario.id}"`));
    }
  } finally { rmSync(f.project, { recursive: true, force: true }); }
});

test('report preserves failed attempts, distinguishes optional scope and blocks unresolved flakes', () => {
  const f = fixture();
  try {
    const { suite, run } = readRun(f.root, 'first');
    run.observedBuild = 'asset main-test.js; running SHA unproven';
    assert.equal(buildReport(suite, run, [outcome('failed')]).recommendation, 'hold');
    const lowerBoundary = outcome('passed');
    lowerBoundary.boundary = 'Synthetic local JSON fixture only';
    assert.equal(buildReport(suite, run, [lowerBoundary]).recommendation, 'readiness-unproven');
    assert.equal(buildReport(suite, run, [lowerBoundary]).cases[0].status, 'inconclusive');
    const unevidenced = outcome('passed');
    unevidenced.evidence = [];
    assert.equal(buildReport(suite, run, [unevidenced]).cases[0].status, 'inconclusive');
    const observed = run.observedBuild;
    run.observedBuild = '  ';
    assert.equal(buildReport(suite, run, [outcome('passed')]).recommendation, 'readiness-unproven');
    run.observedBuild = observed;
    const flaky = buildReport(suite, run, [outcome('failed'), outcome('passed', 2)]);
    assert.equal(flaky.cases[0].attempts.length, 2);
    assert.equal(flaky.cases[0].status, 'inconclusive');
    assert.equal(flaky.recommendation, 'readiness-unproven');
    const corrected = outcome('passed', 2);
    corrected.resolution = { kind: 'harness-corrected', reason: 'The first run used the wrong route; the exact app contract is unchanged.' };
    assert.equal(buildReport(suite, run, [outcome('failed'), corrected]).recommendation, 'ready-for-tested-scope');
    suite.scenarios.push({ ...suite.scenarios[0], id: 'QA-OPTIONAL', critical: false } as Scenario);
    assert.equal(buildReport(suite, run, [outcome('passed')]).recommendation, 'ready-for-tested-scope');
    run.fixtures.push({ id: 'owned-fixture', owner: 'lane-1', cleanup: 'pending', note: 'Awaiting dependent case' });
    assert.equal(buildReport(suite, run, [outcome('passed')]).recommendation, 'readiness-unproven');
  } finally { rmSync(f.project, { recursive: true, force: true }); }
});

test('HTML escapes observations and embeds only inspected raster images inside the run', () => {
  const f = fixture();
  try {
    const pixel = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jp1sAAAAASUVORK5CYII=', 'base64');
    writeFileSync(join(f.run, 'screenshots', 'synthetic.png'), pixel);
    writeFileSync(join(f.root, 'outside.png'), pixel);
    mkdirSync(join(f.run, 'private'), { recursive: true });
    writeFileSync(join(f.run, 'private', 'secret.png'), pixel);
    const { suite, run } = readRun(f.root, 'first');
    const result = outcome('passed');
    result.actual = '<script>alert("unsafe")</script>';
    result.screenshots = [
      { path: 'screenshots/synthetic.png', caption: 'Inspected synthetic pixel', inspected: true },
      { path: '../../outside.png', caption: 'Outside', inspected: true },
      { path: 'private/secret.png', caption: 'Private', inspected: true },
      { path: 'PRIVATE/secret.png', caption: 'Case-insensitive private path', inspected: true },
      { path: 'screenshots/synthetic.png', caption: 'Uninspected', inspected: false },
    ];
    const html = renderHtml(buildReport(suite, run, [result]), f.run);
    assert.equal((html.match(/src="data:image\/png;base64,/g) ?? []).length, 1);
    assert.ok(html.includes('&lt;script&gt;'));
    assert.ok(!html.includes('<script>'));
    writeJson(join(f.run, 'results.json'), [result]);
    writeReport(f.root, 'first');
    const json = readJson<Report>(join(f.run, 'report.json'));
    const markdown = readFileSync(join(f.run, 'report.md'), 'utf8');
    assert.ok(markdown.includes(json.recommendation));
    assert.equal(json.counts.passed, 1);
  } finally { rmSync(f.project, { recursive: true, force: true }); }
});

test('private host references survive snapshots and reports without resolving their values', () => {
  const f = fixture();
  try {
    const privateUrl = 'https://host.example.test/private/synthetic-capability';
    writeFileSync(join(f.root, '.env.qa'), `OWLBEAR_URL=${privateUrl}\n`);
    const config = readJson<Config>(join(f.root, 'config.json'));
    config.environments[0].hostUrlEnv = 'OWLBEAR_URL';
    writeJson(join(f.root, 'config.json'), config);
    approve(f.root, 'setup', 'offline-private-reference-decision');
    const directory = startRun(f.root, 'canary', 'private-host', 'first-run');
    writeReport(f.root, 'private-host');
    for (const file of ['suite.json', 'report.json', 'report.html', 'report.md']) {
      assert.ok(!readFileSync(join(directory, file), 'utf8').includes(privateUrl));
    }
    assert.equal(readJson<Report>(join(directory, 'report.json')).target.hostUrlEnv, 'OWLBEAR_URL');
  } finally { rmSync(f.project, { recursive: true, force: true }); }
});
