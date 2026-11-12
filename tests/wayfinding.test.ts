import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { main } from '../scripts/qa.ts';
import { closeCharter } from '../scripts/closing.ts';
import { claim, frontier, loadChart, renderMap, saveChart } from '../scripts/wayfinding.ts';
import { lockSuite, readJson, writeJson } from '../scripts/workspace.ts';
import type { Chart, Charter, Result, RouteInteractions, RouteInventory, Run, Scenario } from '../scripts/models.ts';
import { fixture } from './helpers.ts';

function charter(partial: Pick<Charter, 'id' | 'name' | 'kind'> & Partial<Charter>): Charter {
  return { mode: 'AFK', mission: `Mission for ${partial.name}`, blockedBy: [], status: 'open', claimedBy: null, gist: '', ...partial };
}

function edit(root: string, change: (chart: Chart) => void): void {
  const chart = loadChart(root);
  change(chart);
  saveChart(root, chart);
}

test('init charts the opening: setup on the frontier, route finding blocked, later layers in the fog', () => {
  const f = fixture();
  try {
    const chart = loadChart(f.root);
    assert.deepEqual(frontier(chart).map(item => item.id), ['setup']);
    assert.equal(chart.destination, '');
    assert.ok(chart.fog.some(line => line.includes('Adversarial')));
    const map = main(['map', f.root]);
    assert.match(map, /Not named yet/);
    assert.match(map, /\*\*Find every route\*\* waits on Set up the QA effort/);
    assert.match(map, /Claim \*\*Set up the QA effort\*\*/);
    assert.equal(readFileSync(join(f.root, 'map.md'), 'utf8'), map);
    assert.throws(() => main(['chart', f.root]), /already exists/);
  } finally { rmSync(f.project, { recursive: true, force: true }); }
});

test('a claimant holds one charter at a time and blocked or taken charters cannot be claimed', () => {
  const f = fixture();
  try {
    assert.throws(() => claim(f.root, 'find-routes', 'parent'), /waits on: Set up the QA effort/);
    const brief = main(['claim', f.root, 'setup']);
    assert.match(brief, /Read: references\/init\.md/);
    assert.match(brief, /Done when: The destination is named/);
    assert.equal(main(['claim', f.root, 'setup']), brief);
    assert.throws(() => claim(f.root, 'setup', 'lane-1'), /claimed by parent/);
    edit(f.root, chart => { chart.charters.push(charter({ id: 'side-task', name: 'A side task', kind: 'task' })); });
    assert.throws(() => claim(f.root, 'side-task', 'parent'), /already holds Set up the QA effort/);
    assert.match(claim(f.root, 'side-task', 'lane-1'), /In hand: A side task/);
    assert.match(main(['map', f.root]), /Finish \*\*Set up the QA effort\*\*/);
    main(['release', f.root, 'setup']);
    assert.ok(frontier(loadChart(f.root)).some(item => item.id === 'setup'));
  } finally { rmSync(f.project, { recursive: true, force: true }); }
});

test('setup closes only with a named destination and a current setup confirmation', () => {
  const f = fixture();
  try {
    assert.throws(() => closeCharter(f.root, 'setup', 'done'), /Name the destination/);
    edit(f.root, chart => { chart.destination = 'A locked happy-path baseline for the example app.'; });
    assert.throws(() => closeCharter(f.root, 'setup', 'two\nlines'), /one-line gist/);
    assert.match(main(['close', f.root, 'setup', 'Canary with owner and member; owned fixtures only.']), /Closed Set up the QA effort/);
    const map = renderMap(f.root);
    assert.match(map, /\*\*Set up the QA effort\*\*: Canary with owner and member/);
    assert.match(map, /Claim \*\*Find every route\*\*/);
    assert.throws(() => closeCharter(f.root, 'setup', 'again'), /already closed/);
  } finally { rmSync(f.project, { recursive: true, force: true }); }
});

test('route finding closes only when every pending route has its own inventory charter', () => {
  const f = fixture();
  try {
    edit(f.root, chart => { chart.destination = 'Baseline.'; });
    closeCharter(f.root, 'setup', 'Setup confirmed.');
    const routes = readJson<RouteInventory>(join(f.root, 'routes.json'));
    routes.routes.push({ id: 'party', pattern: '/party/:id', title: 'Party roster', sources: ['crawl'], identities: ['owner', 'member'], status: 'pending', reason: '' });
    writeJson(join(f.root, 'routes.json'), routes);
    assert.throws(() => closeCharter(f.root, 'find-routes', 'Found 4 routes.'), /Pending routes without an inventory charter: party/);
    edit(f.root, chart => { chart.charters.push(charter({ id: 'inventory-party', name: 'Inventory the party roster', kind: 'inventory', subjects: ['party'], blockedBy: ['find-routes'] })); });
    closeCharter(f.root, 'find-routes', 'Found 4 routes.');
    assert.deepEqual(frontier(loadChart(f.root)).map(item => item.id), ['inventory-party']);
  } finally { rmSync(f.project, { recursive: true, force: true }); }
});

test('an inventory closes only when every element was operated or classified, and barriers have a note', () => {
  const f = fixture();
  try {
    edit(f.root, chart => { chart.charters.push(charter({ id: 'inventory-draft-editor', name: 'Inventory the draft editor', kind: 'inventory', subjects: ['draft-editor'] })); });
    const file = join(f.root, 'interactions', 'draft-editor.json');
    const entry = readJson<RouteInteractions>(file);
    entry.interactions.push({ section: 'header', element: 'export', action: 'click', role: 'button', locator: "getByRole('button', { name: 'Export' })", status: 'pending', effect: '' });
    writeJson(file, entry);
    assert.throws(() => closeCharter(f.root, 'inventory-draft-editor', 'Done.'), /Not yet operated or classified: draft-editor\/header\/export\/click/);
    entry.interactions.at(-1)!.status = 'barrier';
    entry.interactions.at(-1)!.effect = 'Export is produced by a third-party service behind a bot check.';
    entry.interactions.at(-1)!.barrier = 'export-bot-check';
    writeJson(file, entry);
    assert.throws(() => closeCharter(f.root, 'inventory-draft-editor', 'Done.'), /existing barrier note/);
    writeFileSync(join(f.root, 'barriers', 'export-bot-check.md'), '# Bot check on export\n');
    closeCharter(f.root, 'inventory-draft-editor', '4 interactions: 2 operated, 1 skipped, 1 behind the export bot check.');
    assert.match(renderMap(f.root), /1 noted in barriers\/: export-bot-check/);
    assert.match(main(['interactions', f.root]), /Interactions: 2 operated, 1 skipped, 1 behind barriers, 0 pending/);
  } finally { rmSync(f.project, { recursive: true, force: true }); }
});

test('scenario, run and lock charters close against the recorded state, not the claim that they are done', () => {
  const f = fixture();
  try {
    edit(f.root, chart => {
      chart.charters.push(
        charter({ id: 'happy-drafts', name: 'Happy paths for draft editing', kind: 'scenarios', tier: 'happy', mode: 'HITL', subjects: ['PATH-001'] }),
        charter({ id: 'error-drafts', name: 'Error paths for draft editing', kind: 'scenarios', tier: 'error', mode: 'HITL', subjects: ['PATH-001'] }),
        charter({ id: 'happy-run', name: 'Happy run under scrutiny', kind: 'run', subjects: ['first'], blockedBy: ['happy-drafts'] }),
        charter({ id: 'lock-baseline', name: 'Lock the baseline', kind: 'lock', mode: 'HITL', blockedBy: ['happy-run'] }),
      );
    });
    assert.throws(() => closeCharter(f.root, 'error-drafts', 'Done.'), /has no error-tier scenario/);
    assert.throws(() => closeCharter(f.root, 'happy-run', 'Done.'), /still waits on: happy-drafts/);
    closeCharter(f.root, 'happy-drafts', 'One happy path confirmed.');
    assert.throws(() => closeCharter(f.root, 'happy-run', 'Done.'), /record the observed build[\s\S]*no recorded disposition for: A saved draft survives reload[\s\S]*render the report/);
    const run = readJson<Run>(join(f.run, 'run.json'));
    run.observedBuild = 'synthetic-build';
    writeJson(join(f.run, 'run.json'), run);
    const result: Result = { scenarioId: 'QA-001', attempt: 1, status: 'passed', at: new Date().toISOString(), actual: 'Synthetic pass.', browser: 'chromium', viewport: '1440x900', locale: 'en', boundary: 'Deployed UI plus real API persistence', screenshots: [], evidence: ['synthetic'] };
    writeJson(join(f.run, 'results.json'), [result]);
    main(['report', f.root, 'first']);
    closeCharter(f.root, 'happy-run', '1 of 1 passed on synthetic-build.');
    assert.throws(() => closeCharter(f.root, 'lock-baseline', 'Done.'), /Nothing is locked yet/);
    lockSuite(f.root, 'first', 'offline-lock');
    closeCharter(f.root, 'lock-baseline', 'Baseline locked: 1 happy scenario.');
    assert.match(renderMap(f.root), /Locked so far: 1 happy \(source run first\)/);
    const scenario = readJson<Scenario>(join(f.root, 'scenarios', 'QA-001.json'));
    scenario.expected.push('A changed expectation');
    writeJson(join(f.root, 'scenarios', 'QA-001.json'), scenario);
    edit(f.root, chart => { chart.charters.push(charter({ id: 'relock', name: 'Lock again', kind: 'lock', mode: 'HITL' })); });
    assert.throws(() => closeCharter(f.root, 'relock', 'Done.'), /current user approval/);
  } finally { rmSync(f.project, { recursive: true, force: true }); }
});

test('ruling a charter out of scope clears it from the frontier and unblocks what waited on it', () => {
  const f = fixture();
  try {
    edit(f.root, chart => {
      chart.charters.push(
        charter({ id: 'billing', name: 'Inventory billing', kind: 'inventory', subjects: ['billing'] }),
        charter({ id: 'after-billing', name: 'Group routes into capabilities', kind: 'task', blockedBy: ['billing'] }),
      );
    });
    assert.throws(() => main(['rule-out', f.root, 'billing']), /reason/);
    main(['rule-out', f.root, 'billing', 'Payments are beyond this destination.']);
    const map = renderMap(f.root);
    assert.match(map, /## Out of scope\n\n- \*\*Inventory billing\*\*: Payments are beyond this destination\./);
    assert.ok(frontier(loadChart(f.root)).some(item => item.id === 'after-billing'));
    assert.throws(() => claim(f.root, 'billing', 'parent'), /already out-of-scope/);
  } finally { rmSync(f.project, { recursive: true, force: true }); }
});

test('a malformed chart is refused, long sections stay low-resolution, and an old workspace is told how to adopt the map', () => {
  const f = fixture();
  try {
    assert.throws(() => edit(f.root, chart => { chart.charters[0].blockedBy = ['find-routes']; }), /cycle/);
    assert.throws(() => edit(f.root, chart => { chart.charters.push(charter({ id: 'x', name: 'X', kind: 'task', blockedBy: ['missing'] })); }), /unknown charter missing/);
    assert.throws(() => edit(f.root, chart => { chart.charters.push(charter({ id: 'y', name: 'Y', kind: 'inventory' })); }), /needs subjects/);
    assert.throws(() => edit(f.root, chart => { chart.charters.push(charter({ id: 'z', name: 'Z', kind: 'task', status: 'closed' })); }), /one-line gist/);
    edit(f.root, chart => {
      for (let index = 1; index <= 12; index += 1) {
        chart.charters.push(charter({ id: `inventory-r${index}`, name: `Inventory route ${index}`, kind: 'inventory', subjects: [`r${index}`] }));
      }
    });
    assert.match(renderMap(f.root), /…and 5 more/);
    assert.match(main(['map', f.root, 'all']), /Inventory route 12/);
    rmSync(join(f.root, 'charters.json'));
    assert.throws(() => main(['map', f.root]), /no map yet/);
    assert.match(main(['chart', f.root]), /Claim \*\*Set up the QA effort\*\*/);
    assert.ok(existsSync(join(f.root, 'routes.json')));
  } finally { rmSync(f.project, { recursive: true, force: true }); }
});
