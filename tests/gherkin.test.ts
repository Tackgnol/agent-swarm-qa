import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { AstBuilder, GherkinClassicTokenMatcher, Parser } from '@cucumber/gherkin';
import { exportGherkin } from '../scripts/to-gherkin.ts';
import { main } from '../scripts/qa.ts';
import { approve, readJson, writeJson } from '../scripts/workspace.ts';
import type { PathMap, Scenario } from '../scripts/models.ts';
import { fixture } from './helpers.ts';

function parse(source: string) {
  let id = 0;
  const parser = new Parser(new AstBuilder(() => String(++id)), new GherkinClassicTokenMatcher('en'));
  return parser.parse(source).feature!;
}

test('export parses as Gherkin and preserves approved Given/When/Then wording and IDs', () => {
  const f = fixture();
  try {
    const directory = main(['to-gherkin', f.root, 'approved']);
    const feature = parse(readFileSync(join(directory, 'PATH-001.feature'), 'utf8'));
    const original = readJson<Scenario>(join(f.root, 'scenarios', 'QA-001.json'));
    assert.deepEqual(feature.tags.map(tag => tag.name), ['@qa', '@draft', '@PATH-001']);
    assert.equal(feature.children.length, 1);
    const scenario = feature.children[0].scenario!;
    assert.deepEqual(scenario.tags.map(tag => tag.name), ['@QA-001', '@critical']);
    assert.deepEqual(scenario.steps.map(step => step.text), [...original.preconditions, ...original.steps, ...original.expected]);
    assert.deepEqual(scenario.steps.map(step => step.keyword.trim()), ['Given', 'When', 'And', 'And', 'Then', 'And']);
    const manifest = readJson<{ source: string; files: { scenarios: { id: string; source: string; contentHash: string }[] }[] }>(join(directory, 'manifest.json'));
    assert.equal(manifest.source, 'current-approved-specs');
    assert.equal(manifest.files[0].scenarios[0].id, original.id);
    assert.equal(manifest.files[0].scenarios[0].source, 'scenarios/QA-001.json');
    assert.equal(manifest.files[0].scenarios[0].contentHash, original.approval!.contentHash);
  } finally { rmSync(f.project, { recursive: true, force: true }); }
});

test('changing or corrupting observed results cannot change any exported file', () => {
  const f = fixture();
  try {
    const first = exportGherkin(f.root, 'before-results');
    writeFileSync(join(f.run, 'results.json'), '{ invalid result JSON: actual behavior is WRONG, status FAILED');
    writeFileSync(join(f.run, 'report.md'), 'Then the application should do the wrong observed behavior');
    const second = exportGherkin(f.root, 'after-results');
    assert.deepEqual(readdirSync(first).sort(), readdirSync(second).sort());
    for (const file of readdirSync(first)) {
      assert.equal(readFileSync(join(first, file), 'utf8'), readFileSync(join(second, file), 'utf8'));
    }
  } finally { rmSync(f.project, { recursive: true, force: true }); }
});

test('stale or unapproved specs stop the export before writing output', () => {
  const f = fixture();
  try {
    const path = join(f.root, 'scenarios', 'QA-001.json');
    const scenario = readJson<Scenario>(path);
    scenario.expected = ['A revised expectation that has not been approved'];
    writeJson(path, scenario);
    assert.throws(() => exportGherkin(f.root, 'unapproved'), /current user approval/);
    assert.ok(!existsSync(join(f.root, 'exports', 'gherkin', 'unapproved')));
  } finally { rmSync(f.project, { recursive: true, force: true }); }
});

test('export works without a QA run or private credential file', () => {
  const f = fixture();
  try {
    rmSync(join(f.root, 'runs'), { recursive: true, force: true });
    rmSync(join(f.root, '.env.qa'));
    assert.ok(existsSync(join(exportGherkin(f.root, 'specs-only'), 'PATH-001.feature')));
  } finally { rmSync(f.project, { recursive: true, force: true }); }
});

test('multiline specification text round-trips without adding injected scenarios or steps', () => {
  const f = fixture();
  try {
    const scenario = readJson<Scenario>(join(f.root, 'scenarios', 'QA-001.json'));
    scenario.title = 'Unicode Śląsk\nScenario: this is still the title';
    scenario.preconditions = ['The exact text is:\nFeature: not syntax\n  """\n  ```\n<value> | "quoted" \\path'];
    scenario.steps = ['Input this text:\r\nScenario: not another scenario'];
    scenario.expected = ['Keep the original text:\nThen this is not a step\n  """'];
    writeJson(join(f.root, 'scenarios', 'QA-001.json'), scenario);
    approve(f.root, 'QA-001', 'offline-multiline-spec-approval');
    const feature = parse(readFileSync(join(exportGherkin(f.root, 'multiline'), 'PATH-001.feature'), 'utf8'));
    assert.equal(feature.children.length, 1);
    const steps = feature.children[0].scenario!.steps;
    assert.equal(steps.length, 3);
    assert.deepEqual(steps.map(step => JSON.parse(step.docString!.content) as string), [...scenario.preconditions, ...scenario.steps, ...scenario.expected]);
    assert.ok(steps.every(step => step.docString?.mediaType === 'json'));
  } finally { rmSync(f.project, { recursive: true, force: true }); }
});

test('existing exports are not overwritten and traversal IDs are rejected', () => {
  const f = fixture();
  try {
    const directory = exportGherkin(f.root, 'reviewed');
    const file = join(directory, 'PATH-001.feature');
    writeFileSync(file, '# User-edited review draft');
    assert.throws(() => exportGherkin(f.root, 'reviewed'), /Export already exists/);
    assert.equal(readFileSync(file, 'utf8'), '# User-edited review draft');
    assert.throws(() => exportGherkin(f.root, '../../outside'));
  } finally { rmSync(f.project, { recursive: true, force: true }); }
});

test('paths group their own scenarios while approved exclusions have no feature file', () => {
  const f = fixture();
  try {
    const map = readJson<PathMap>(join(f.root, 'map.json'));
    const original = readJson<Scenario>(join(f.root, 'scenarios', 'QA-001.json'));
    map.paths.push({ ...map.paths[0], id: 'PATH-002', title: 'Second behavior', scenarioIds: ['QA-002'], approval: null });
    map.paths.push({ id: 'PATH-003', title: 'Explicitly excluded', route: '/excluded', scenarioIds: [], disposition: 'excluded', reason: 'Outside the approved scope', approval: null });
    writeJson(join(f.root, 'map.json'), map);
    writeJson(join(f.root, 'scenarios', 'QA-002.json'), { ...original, id: 'QA-002', pathId: 'PATH-002', preconditions: [], critical: false, approval: null });
    approve(f.root, 'path:PATH-002', 'offline-second-path');
    approve(f.root, 'QA-002', 'offline-second-case');
    approve(f.root, 'path:PATH-003', 'offline-exclusion');
    const directory = exportGherkin(f.root, 'grouped');
    assert.deepEqual(readdirSync(directory).sort(), ['PATH-001.feature', 'PATH-002.feature', 'manifest.json']);
    const second = parse(readFileSync(join(directory, 'PATH-002.feature'), 'utf8'));
    assert.equal(second.children[0].scenario!.tags[0].name, '@QA-002');
    assert.equal(second.children[0].scenario!.steps[0].keyword.trim(), 'When');
  } finally { rmSync(f.project, { recursive: true, force: true }); }
});
