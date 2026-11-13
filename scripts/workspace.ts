import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fingerprint, readJson, safeId, writeJson } from './store.ts';
import { interactionsHash, loadInteractions, resolveOperation } from './interactions.ts';
import { seedChart } from './wayfinding.ts';
import type { Approval, Config, Lock, PathMap, Result, ReviewCursor, Run, Scenario, Suite, Tier } from './models.ts';

export { fingerprint, inside, readJson, safeId, writeJson } from './store.ts';

/** Fingerprint what the user approves. Operating knowledge (operations, route links) is agent-owned and stays outside it. */
export function approvalHash(value: Config | Scenario | PathMap['paths'][number]): string {
  const { approval, setupApproval, operations, routes, productRoot, ...content } = value as unknown as Record<string, unknown>;
  return fingerprint(content);
}

const tiers: Tier[] = ['happy', 'error', 'adversarial'];

function checkScenario(scenario: Scenario): void {
  assert.ok(scenario.steps.length > 0 && scenario.expected.length > 0 && scenario.title && scenario.boundary, 'Scenarios need steps, expectations and an observable test boundary.');
  assert.ok(scenario.tier === undefined || tiers.includes(scenario.tier), `${scenario.id} has an unknown tier: use happy, error or adversarial.`);
  assert.ok(scenario.tier !== 'adversarial' || scenario.rule?.trim(), `${scenario.id} is adversarial: name the rule it tries to break.`);
  assert.ok(scenario.operations === undefined || (Array.isArray(scenario.operations) && scenario.operations.every(item => typeof item === 'string')), `${scenario.id}: operations is a list of route/section/element/action addresses.`);
}

export function suiteFingerprint(config: Config, map: PathMap, scenarios: Scenario[]): string {
  return fingerprint({ config: approvalHash(config), paths: map.paths.map(approvalHash), scenarios: scenarios.map(approvalHash) });
}

/** Collect private prerequisite names without loading their values. */
export function requiredEnvKeys(config: Config): string[] {
  const keys = [...new Set([
    ...config.identities.flatMap(identity => identity.envKeys),
    ...(config.privateEnvKeys ?? []),
    ...config.environments.flatMap(environment => environment.hostUrlEnv !== undefined ? [environment.hostUrlEnv] : []),
  ])];
  assert.ok(keys.every(key => typeof key === 'string' && /^[A-Z_][A-Z0-9_]*$/.test(key)), 'Private references must be env key names.');
  return keys;
}

/** Create only empty secret slots; existing workspaces and credentials are never overwritten. */
/**
 * Create a workspace at <product>/.scratch/QA/<name>, or at <directory>/.scratch/QA/<name> when the product's own folder
 * is the wrong place (a read-only checkout, a repository that should not hold QA files, a cloud session).
 */
export function initialize(projectRoot: string, name: string, directory?: string): string {
  assert.ok(existsSync(projectRoot) && statSync(projectRoot).isDirectory(), 'Choose an existing product directory.');
  const parent = directory ?? projectRoot;
  assert.ok(existsSync(parent) && statSync(parent).isDirectory(), 'Choose an existing directory for the workspace.');
  const root = join(resolve(parent), '.scratch', 'QA', safeId(name));
  assert.ok(!existsSync(root), 'QA workspace already exists; resume it instead.');
  for (const path of ['scenarios', 'runners/lib', 'runs', 'issues', 'interview', 'interactions', 'barriers', 'private']) {
    mkdirSync(join(root, path), { recursive: true });
  }
  writeFileSync(join(root, '.gitignore'), '*\n!.gitignore\n', 'utf8');
  writeFileSync(join(root, '.env.qa'), '# Fill locally. The agent must never open or print this file.\n', { mode: 0o600, flag: 'wx' });
  writeFileSync(join(root, '.env.qa.example'), '# Non-sensitive key names only. Add account-specific empty slots after the init interview.\n', 'utf8');
  const config: Config = {
    version: 1, project: name, environments: [], identities: [], privateEnvKeys: [],
    issues: { provider: 'undecided', destination: '', mode: 'undecided' },
    coverage: { browsers: [], locales: [], viewports: [] }, mutationPolicy: 'undecided', setupApproval: null,
    ...(directory ? { productRoot: resolve(projectRoot) } : {}),
  };
  writeJson(join(root, 'config.json'), config);
  writeJson(join(root, 'map.json'), { version: 1, paths: [] });
  writeJson(join(root, 'routes.json'), { version: 1, routes: [] });
  seedChart(root);
  writeJson(join(root, 'checkpoint.json'), { phase: 'init', pendingQuestions: [], nextAction: 'Run qa.ts map <qa-root> and take the first frontier charter.' });
  writeFileSync(join(root, 'runners', 'lib', 'app.cjs'), appStarter(), { encoding: 'utf8', flag: 'wx' });
  writeFileSync(join(root, 'interview', 'decisions.md'), '# QA decisions\n\nRecord the actual user answers and decision references here. Never store credentials.\n', 'utf8');
  return root;
}

/** Starter for the product's own runner helpers, built on the shipped harness. */
function appStarter(): string {
  const harness = join(dirname(dirname(fileURLToPath(import.meta.url))), 'scripts', 'harness.cjs');
  return `// App-specific helpers shared by every runner of this workspace. Fill in what this app needs, once.
// Session facts (script format, proxy quirks, first-visit dialogs) also belong in the map's notes.
const path = require('node:path');
const fs = require('node:fs');
const qa = require(${JSON.stringify(harness)});

const QA_ROOT = path.resolve(__dirname, '..', '..');
const config = JSON.parse(fs.readFileSync(path.join(QA_ROOT, 'config.json'), 'utf8'));

/** Open a session on a configured environment, optionally resuming a saved identity from private/. */
async function start({ environment = config.environments[0]?.name, viewport, state } = {}) {
  const target = config.environments.find(entry => entry.name === environment);
  if (!target) { throw new Error(\`Unknown environment \${environment}; see config.json.\`); }
  const storageState = state ? qa.privatePath(QA_ROOT, \`\${state}.json\`) : undefined;
  const current = await qa.session({ baseUrl: target.appUrl, viewport, storageState: storageState && fs.existsSync(storageState) ? storageState : undefined });
  return current;
}

/** Dismiss whatever the app shows on a first visit (consent notice, tour). Write it once the inventory has seen it. */
async function firstVisit(page) {
  void page;
}

/** Sign in as an identity alias. Credentials come from the trusted env loader; never log them. */
async function signIn(page, alias) {
  void page;
  throw new Error(\`signIn(\${alias}) is not written yet.\`);
}

module.exports = { QA_ROOT, config, qa, start, firstVisit, signIn };
`;
}

export function hasApproval(value: Config | Scenario | PathMap['paths'][number], approval: Approval | null): boolean {
  return Boolean(approval?.decisionRef?.trim() && !Number.isNaN(Date.parse(approval.at)) && approval.contentHash === approvalHash(value));
}

/** Persist the first unfinished path in stable numeric order without deleting or renumbering IDs. */
export function reviewPath(root: string): ReviewCursor {
  const map = readJson<PathMap>(join(root, 'map.json'));
  const paths = new Map(map.paths.map(path => [safeId(path.id), path]));
  assert.equal(paths.size, map.paths.length, 'Duplicate mapped path IDs.');
  const file = join(root, 'review.json');
  const previous = existsSync(file) ? readJson<ReviewCursor>(file) : undefined;
  if (previous) {
    assert.ok(previous.version === 1 && Array.isArray(previous.order), 'Unknown review cursor format; preserve it and reconcile before continuing.');
  }
  const compare = (a: string, b: string): number => a.localeCompare(b, 'en', { numeric: true });
  const added = [...paths.keys()].filter(id => !previous?.order.includes(id)).sort(compare);
  if (previous) {
    assert.ok(previous.order.every(id => paths.has(id)), 'A mapped path ID disappeared: keep its ID and record an excluded disposition instead of renumbering/removing it.');
    const numbered = previous.order.filter(id => /^PATH-\d+$/i.test(id));
    const maximum = Math.max(0, ...numbered.map(id => Number(id.slice(5))));
    const addedNumbers = added.filter(id => /^PATH-\d+$/i.test(id)).map(id => Number(id.slice(5)));
    assert.ok(addedNumbers.every((number, index) => number === maximum + index + 1), 'New paths must use consecutive numbers after the highest assigned PATH number; never reuse gaps, skip numbers or renumber existing paths.');
  }
  const order = previous ? [...previous.order, ...added] : added;
  const completedPathIds = order.filter(id => {
    const path = paths.get(id)!;
    if (!hasApproval(path, path.approval)) {
      return false;
    }
    if (path.disposition === 'excluded') {
      return Boolean(path.reason.trim() && path.scenarioIds.length === 0);
    }
    return path.disposition === 'included' && path.scenarioIds.length > 0 && path.scenarioIds.every(scenarioId => {
      const scenarioFile = join(root, 'scenarios', `${safeId(scenarioId)}.json`);
      if (!existsSync(scenarioFile)) {
        return false;
      }
      const scenario = readJson<Scenario>(scenarioFile);
      return scenario.id === scenarioId && scenario.pathId === id && hasApproval(scenario, scenario.approval);
    });
  });
  const pendingPathIds = order.filter(id => !completedPathIds.includes(id));
  const overridePathId = previous?.overridePathId && pendingPathIds.includes(previous.overridePathId) ? previous.overridePathId : null;
  const currentPathId = overridePathId ?? pendingPathIds[0] ?? null;
  const cursor: ReviewCursor = {
    version: 1, order, currentPathId, overridePathId, pendingPathIds, completedPathIds,
    scenarioIds: currentPathId ? paths.get(currentPathId)!.scenarioIds : [], jumps: previous?.jumps ?? [],
  };
  writeJson(file, cursor);
  return cursor;
}

export function focusReviewPath(root: string, id: string, decisionRef: string, reason: string): ReviewCursor {
  assert.ok(decisionRef.trim() && reason.trim(), 'An actual user decision reference and reason are required for a review jump.');
  const cursor = reviewPath(root);
  assert.ok(cursor.pendingPathIds.includes(id), 'Choose an existing unfinished path.');
  cursor.jumps.push({ from: cursor.currentPathId, to: id, decisionRef, reason, at: new Date().toISOString() });
  cursor.overridePathId = id;
  writeJson(join(root, 'review.json'), cursor);
  return reviewPath(root);
}

export function nextPathId(root: string): string {
  const map = readJson<PathMap>(join(root, 'map.json'));
  const cursor = reviewPath(root);
  const ids = [...cursor.order, ...map.paths.map(path => path.id)].filter(id => /^PATH-\d+$/i.test(id));
  return `PATH-${String(Math.max(0, ...ids.map(id => Number(id.slice(5)))) + 1).padStart(3, '0')}`;
}

/** Record a real user's decision after the interview, never infer consent from silence. */
export function approve(root: string, subject: string, decisionRef: string): void {
  assert.ok(decisionRef.trim(), 'A reference to the actual user decision is required.');
  let path: string;
  let value: Config | Scenario | PathMap['paths'][number];
  let map: PathMap | undefined;
  if (subject === 'setup') {
    path = join(root, 'config.json');
    value = readJson<Config>(path);
  } else if (subject.startsWith('path:')) {
    path = join(root, 'map.json');
    map = readJson<PathMap>(path);
    const entry = map.paths.find(item => item.id === subject.slice(5));
    assert.ok(entry, 'Unknown mapped path.');
    assert.notEqual(entry.disposition, 'pending', 'Choose included or excluded before approval.');
    value = entry;
  } else {
    path = join(root, 'scenarios', `${safeId(subject)}.json`);
    value = readJson<Scenario>(path);
  }
  if (subject !== 'setup' && !hasApproval(value, (value as Scenario).approval)) {
    const targetPath = subject.startsWith('path:') ? (value as PathMap['paths'][number]).id : (value as Scenario).pathId;
    const cursor = reviewPath(root);
    assert.equal(targetPath, cursor.currentPathId, `Review ${cursor.currentPathId ?? '(no unfinished path)'} first. An explicit user-authorized focus-path decision is required to jump.`);
  }
  const approval: Approval = { decisionRef, at: new Date().toISOString(), contentHash: approvalHash(value) };
  if (subject === 'setup') {
    (value as Config).setupApproval = approval;
  } else {
    (value as Scenario).approval = approval;
  }
  writeJson(path, map ?? value);
  if (subject !== 'setup') {
    reviewPath(root);
  }
}

/** Record one displayed scope confirmation across its derived cases, preflighting before any approvals change. */
export function approveBatch(root: string, decisionRef: string, pathIds: string[]): ReviewCursor {
  assert.ok(decisionRef.trim(), 'A reference to the actual user scope confirmation is required.');
  assert.ok(pathIds.length > 0 && new Set(pathIds).size === pathIds.length, 'List the exact displayed path IDs once each.');
  const cursor = reviewPath(root);
  const map = readJson<PathMap>(join(root, 'map.json'));
  assert.ok(pathIds.every(id => map.paths.some(path => path.id === id)), 'Unknown mapped path.');
  const pending = pathIds.filter(id => cursor.pendingPathIds.includes(id));
  const frontier = [cursor.currentPathId, ...cursor.pendingPathIds.filter(id => id !== cursor.currentPathId)].filter((id): id is string => id !== null);
  assert.deepEqual(pending, frontier.slice(0, pending.length), 'A batch must follow the review frontier without skipping unfinished paths.');
  const scenarios: Scenario[] = [];
  const mapped = new Set<string>();
  const at = new Date().toISOString();
  for (const id of pathIds) {
    const path = map.paths.find(entry => entry.id === id)!;
    assert.ok(['included', 'excluded'].includes(path.disposition), 'Choose included or excluded before scope confirmation.');
    assert.ok(path.disposition === 'included' ? path.scenarioIds.length > 0 : path.reason.trim() && path.scenarioIds.length === 0, 'Included paths need scenarios; exclusions need a reason and no scenarios.');
    for (const scenarioId of path.scenarioIds) {
      assert.ok(!mapped.has(scenarioId), 'Duplicate scenario in scope confirmation.');
      mapped.add(scenarioId);
      const scenario = readJson<Scenario>(join(root, 'scenarios', `${safeId(scenarioId)}.json`));
      assert.ok(scenario.id === scenarioId && scenario.pathId === id, 'Scenario must belong to the displayed path.');
      checkScenario(scenario);
      if (!hasApproval(scenario, scenario.approval)) {
        scenario.approval = { decisionRef, at, contentHash: approvalHash(scenario) };
        scenarios.push(scenario);
      }
    }
    if (!hasApproval(path, path.approval)) {
      path.approval = { decisionRef, at, contentHash: approvalHash(path) };
    }
  }
  for (const scenario of scenarios) {
    writeJson(join(root, 'scenarios', `${scenario.id}.json`), scenario);
  }
  writeJson(join(root, 'map.json'), map);
  return reviewPath(root);
}

/** Validate approved mapping and scenarios, including additions, removals and identity allocations. */
export function loadSuite(root: string): Suite {
  const config = readJson<Config>(join(root, 'config.json'));
  const map = readJson<PathMap>(join(root, 'map.json'));
  assert.equal(config.version, 1);
  assert.equal(map.version, 1);
  reviewPath(root);
  assert.ok(hasApproval(config, config.setupApproval), 'Setup needs current user approval.');
  assert.ok(config.environments.length > 0, 'At least one environment is required.');
  assert.notEqual(config.mutationPolicy, 'undecided', 'Set the mutation boundary.');
  assert.ok(['local', 'github', 'linear', 'other'].includes(config.issues.provider) && ['local', 'draft', 'create'].includes(config.issues.mode) && config.issues.destination.trim(), 'Confirm the issue destination and write mode.');
  const envNames = new Set<string>();
  requiredEnvKeys(config);
  for (const env of config.environments) {
    assert.ok(!envNames.has(safeId(env.name)), 'Duplicate environment name.');
    envNames.add(env.name);
    assert.ok(!(env.hostUrl && env.hostUrlEnv), 'Choose a public host URL or a private host env reference, not both.');
    for (const url of [env.appUrl, env.apiUrl, env.hostUrl].filter(Boolean)) {
      const parsed = new URL(url!);
      assert.ok(['http:', 'https:'].includes(parsed.protocol) && !parsed.username && !parsed.password, 'Use HTTP URLs without embedded credentials.');
    }
    assert.ok(env.appUrl, 'An application URL is required.');
  }
  const aliases = new Set<string>();
  for (const identity of config.identities) {
    assert.ok(!aliases.has(safeId(identity.alias)), 'Duplicate identity alias.');
    aliases.add(identity.alias);
    assert.ok(['guest', 'authenticated'].includes(identity.kind));
    for (const key of identity.envKeys) {
      assert.match(key, /^[A-Z_][A-Z0-9_]*$/, 'Credential references must be env key names, not values.');
    }
  }
  assert.ok(map.paths.length > 0, 'Map at least one path.');
  const scenarios = readdirSync(join(root, 'scenarios')).filter(file => file.endsWith('.json')).sort().map(file => readJson<Scenario>(join(root, 'scenarios', file)));
  const byId = new Map<string, Scenario>();
  for (const scenario of scenarios) {
    safeId(scenario.id);
    assert.ok(!byId.has(scenario.id), 'Duplicate scenario ID.');
    checkScenario(scenario);
    assert.ok(hasApproval(scenario, scenario.approval), `${scenario.id} needs current user approval.`);
    assert.ok(scenario.identities.every(alias => aliases.has(alias)), 'Scenario references an unknown identity.');
    byId.set(scenario.id, scenario);
  }
  const mapped = new Set<string>();
  const pathIds = new Set<string>();
  for (const entry of map.paths) {
    assert.ok(!pathIds.has(safeId(entry.id)), 'Duplicate mapped path ID.');
    pathIds.add(entry.id);
    assert.ok(['included', 'excluded'].includes(entry.disposition) && hasApproval(entry, entry.approval), `${entry.id} needs a reviewed disposition.`);
    if (entry.disposition === 'excluded') {
      assert.ok(entry.reason.trim() && entry.scenarioIds.length === 0, 'Excluded paths need a reason and no executable scenarios.');
    } else {
      assert.ok(entry.scenarioIds.length > 0, 'Included paths need scenarios.');
    }
    for (const id of entry.scenarioIds) {
      assert.ok(!mapped.has(id) && byId.get(id)?.pathId === entry.id, 'Each scenario must belong to its mapped path exactly once.');
      mapped.add(id);
    }
  }
  assert.equal(mapped.size, scenarios.length, 'Unmapped scenario files must be reviewed or removed from the executable suite.');
  assert.ok(scenarios.length > 0, 'At least one approved scenario is required.');
  return { config, map, scenarios, hash: suiteFingerprint(config, map, scenarios) };
}

/** Update the checkpoint's position fields and keep everything else the agent stored there (debt, questions, jobs). */
function mergeCheckpoint(root: string, changes: Record<string, unknown>): void {
  const file = join(root, 'checkpoint.json');
  const current = existsSync(file) ? readJson<Record<string, unknown>>(file) : {};
  writeJson(file, { ...current, ...changes });
}

export function startRun(root: string, environment: string, id: string, phase: Run['phase']): string {
  safeId(id);
  assert.ok(['first-run', 'retest'].includes(phase), 'Use first-run or retest.');
  const suite = loadSuite(root);
  assert.ok(suite.config.environments.some(env => env.name === environment), 'Unknown environment.');
  const lockFile = join(root, 'locked.json');
  const lock = existsSync(lockFile) ? readJson<Lock>(lockFile) : undefined;
  if (phase === 'retest') {
    assert.ok(lock, 'Nothing is locked yet: a retest replays a locked suite.');
    assert.equal(lock.suiteHash, suite.hash, 'Suite changed: review affected decisions and repeat scrutiny before relocking.');
  }
  assert.ok(lock || suite.scenarios.every(scenario => (scenario.tier ?? 'happy') === 'happy'), 'Lock the happy-path baseline before running error or adversarial scenarios.');
  const interactions = loadInteractions(root);
  for (const scenario of suite.scenarios) {
    for (const operation of scenario.operations ?? []) {
      resolveOperation(interactions, operation);
    }
  }
  const operatingHash = interactionsHash(root);
  const path = join(root, 'runs', id);
  assert.ok(!existsSync(path), 'Run already exists; resume it instead.');
  for (const dir of ['screenshots', 'lanes', 'private']) {
    mkdirSync(join(path, dir), { recursive: true });
  }
  writeJson(join(path, 'suite.json'), suite);
  const run: Run = {
    version: 1, id, phase, createdAt: new Date().toISOString(), environment,
    observedBuild: 'unverified', suiteHash: suite.hash, openQuestions: [], fixtures: [], findings: [],
    limits: phase === 'retest' && lock?.interactionsHash && lock.interactionsHash !== operatingHash
      ? ['The inventory changed since the lock: an operation that no longer resolves is inventory drift to repair, not yet a product failure.'] : [],
    interactionsHash: operatingHash, automated: [], fuzzing: [],
  };
  writeJson(join(path, 'run.json'), run);
  writeJson(join(path, 'results.json'), []);
  mergeCheckpoint(root, { phase, runId: id, nextAction: 'Record observed deployment identity; execute approved scenarios.' });
  return path;
}

export function readRun(root: string, id: string): { directory: string; suite: Suite; run: Run; results: Result[] } {
  const directory = join(root, 'runs', safeId(id));
  const suite = readJson<Suite>(join(directory, 'suite.json'));
  const run = readJson<Run>(join(directory, 'run.json'));
  const results = readJson<Result[]>(join(directory, 'results.json'));
  assert.equal(suite.hash, suiteFingerprint(suite.config, suite.map, suite.scenarios), 'Run snapshot was changed.');
  assert.equal(run.suiteHash, suite.hash, 'Run and suite fingerprints differ.');
  assert.equal(run.id, id, 'Run ID differs.');
  assert.ok(Array.isArray(results) && Array.isArray(run.openQuestions) && Array.isArray(run.fixtures) && Array.isArray(run.findings));
  const attempts = new Set<string>();
  for (const result of results) {
    assert.ok(suite.scenarios.some(scenario => scenario.id === result.scenarioId), 'Result references an unknown scenario.');
    assert.ok(Number.isInteger(result.attempt) && result.attempt > 0);
    assert.ok(['passed', 'failed', 'blocked', 'not-run', 'inconclusive'].includes(result.status), 'Invalid result status.');
    assert.ok(result.actual?.trim() && result.boundary?.trim(), 'Results need actual observations and their boundary.');
    assert.ok(Array.isArray(result.screenshots) && Array.isArray(result.evidence), 'Evidence and screenshots must be arrays.');
    assert.ok(!Number.isNaN(Date.parse(result.at)), 'Record an actual observation timestamp.');
    if (result.resolution) {
      assert.ok(['harness-corrected', 'check-corrected', 'expected-behavior'].includes(result.resolution.kind) && result.resolution.reason.trim(), 'Explain an allowed resolution without erasing the original attempt.');
    }
    const key = `${result.scenarioId}:${result.attempt}`;
    assert.ok(!attempts.has(key), 'Duplicate scenario attempt.');
    attempts.add(key);
  }
  return { directory, suite, run, results };
}

/** Lock an approved, scrutinized suite; failures can be baselined without being declared passing. */
export function lockSuite(root: string, id: string, decisionRef: string): void {
  assert.ok(decisionRef.trim(), 'Reference the actual lock-in decision.');
  const current = loadSuite(root);
  const { suite, run, results } = readRun(root, id);
  assert.equal(current.hash, suite.hash, 'Run the revised suite under scrutiny before locking.');
  assert.equal(run.openQuestions.length, 0, 'Resolve the open specification questions before locking.');
  assert.ok(suite.scenarios.every(scenario => results.some(result => result.scenarioId === scenario.id)), 'Every scenario needs an explicit result/disposition.');
  const counts: Record<Tier, number> = { happy: 0, error: 0, adversarial: 0 };
  for (const scenario of suite.scenarios) {
    counts[scenario.tier ?? 'happy'] += 1;
  }
  const lock: Lock = { version: 1, suiteHash: suite.hash, sourceRun: id, decisionRef, at: new Date().toISOString(), tiers: counts, interactionsHash: interactionsHash(root) };
  writeJson(join(root, 'locked.json'), lock);
  mergeCheckpoint(root, { phase: 'locked', runId: id, nextAction: 'Generate the standard report; future runs use the locked scenarios.' });
}
