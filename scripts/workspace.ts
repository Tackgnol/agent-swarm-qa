import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve, relative, isAbsolute } from 'node:path';
import type { Approval, Config, PathMap, Result, Run, Scenario, Suite } from './models.ts';

export function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf8')) as T;
}

export function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonical);
  }
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, canonical(item)]));
  }
  return value;
}

export function fingerprint(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
}

export function approvalHash(value: Config | Scenario | PathMap['paths'][number]): string {
  const { approval, setupApproval, ...content } = value as unknown as Record<string, unknown>;
  return fingerprint(content);
}

export function suiteFingerprint(config: Config, map: PathMap, scenarios: Scenario[]): string {
  return fingerprint({ config: approvalHash(config), paths: map.paths.map(approvalHash), scenarios: scenarios.map(approvalHash) });
}

export function safeId(value: string): string {
  assert.match(value, /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$/, 'Use a short alphanumeric ID with hyphens/underscores.');
  return value;
}

export function inside(root: string, path: string): string {
  const target = resolve(root, path);
  const rel = relative(resolve(root), target);
  assert.ok(rel !== '..' && !rel.startsWith(`..\\`) && !rel.startsWith('../') && !isAbsolute(rel), 'Path must stay inside its workspace.');
  return target;
}

/** Create only empty secret slots; existing workspaces and credentials are never overwritten. */
export function initialize(projectRoot: string, name: string): string {
  assert.ok(existsSync(projectRoot) && statSync(projectRoot).isDirectory(), 'Choose an existing product directory.');
  const root = join(resolve(projectRoot), '.scratch', 'QA', safeId(name));
  assert.ok(!existsSync(root), 'QA workspace already exists; resume it instead.');
  for (const path of ['scenarios', 'runners', 'runs', 'issues', 'interview']) {
    mkdirSync(join(root, path), { recursive: true });
  }
  writeFileSync(join(root, '.gitignore'), '*\n!.gitignore\n', 'utf8');
  writeFileSync(join(root, '.env.qa'), '# Fill locally. The agent must never open or print this file.\n', { mode: 0o600, flag: 'wx' });
  writeFileSync(join(root, '.env.qa.example'), '# Non-sensitive key names only. Add account-specific empty slots after the init interview.\n', 'utf8');
  const config: Config = {
    version: 1, project: name, environments: [], identities: [],
    issues: { provider: 'undecided', destination: '', mode: 'undecided' },
    coverage: { browsers: [], locales: [], viewports: [] }, mutationPolicy: 'undecided', setupApproval: null,
  };
  writeJson(join(root, 'config.json'), config);
  writeJson(join(root, 'map.json'), { version: 1, paths: [] });
  writeJson(join(root, 'checkpoint.json'), { phase: 'init', pendingQuestions: [], nextAction: 'Complete the non-sensitive setup interview.' });
  writeFileSync(join(root, 'interview', 'decisions.md'), '# QA decisions\n\nRecord the actual user answers and decision references here. Never store credentials.\n', 'utf8');
  return root;
}

function hasApproval(value: Config | Scenario | PathMap['paths'][number], approval: Approval | null): boolean {
  return Boolean(approval?.decisionRef?.trim() && !Number.isNaN(Date.parse(approval.at)) && approval.contentHash === approvalHash(value));
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
  const approval: Approval = { decisionRef, at: new Date().toISOString(), contentHash: approvalHash(value) };
  if (subject === 'setup') {
    (value as Config).setupApproval = approval;
  } else {
    (value as Scenario).approval = approval;
  }
  writeJson(path, map ?? value);
}

/** Validate approved mapping and scenarios, including additions, removals and identity allocations. */
export function loadSuite(root: string): Suite {
  const config = readJson<Config>(join(root, 'config.json'));
  const map = readJson<PathMap>(join(root, 'map.json'));
  assert.equal(config.version, 1);
  assert.equal(map.version, 1);
  assert.ok(hasApproval(config, config.setupApproval), 'Setup needs current user approval.');
  assert.ok(config.environments.length > 0, 'At least one environment is required.');
  assert.notEqual(config.mutationPolicy, 'undecided', 'Set the mutation boundary.');
  assert.ok(['local', 'github', 'linear', 'other'].includes(config.issues.provider) && ['local', 'draft', 'create'].includes(config.issues.mode) && config.issues.destination.trim(), 'Confirm the issue destination and write mode.');
  const envNames = new Set<string>();
  for (const env of config.environments) {
    assert.ok(!envNames.has(safeId(env.name)), 'Duplicate environment name.');
    envNames.add(env.name);
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
    assert.ok(scenario.steps.length > 0 && scenario.expected.length > 0 && scenario.title && scenario.boundary, 'Scenarios need steps, expectations and an observable test boundary.');
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

export function startRun(root: string, environment: string, id: string, phase: Run['phase']): string {
  safeId(id);
  assert.ok(['first-run', 'retest'].includes(phase), 'Use first-run or retest.');
  const suite = loadSuite(root);
  assert.ok(suite.config.environments.some(env => env.name === environment), 'Unknown environment.');
  if (phase === 'retest') {
    const lock = readJson<{ suiteHash: string }>(join(root, 'locked.json'));
    assert.equal(lock.suiteHash, suite.hash, 'Suite changed: review affected decisions and repeat scrutiny before relocking.');
  }
  const path = join(root, 'runs', id);
  assert.ok(!existsSync(path), 'Run already exists; resume it instead.');
  for (const dir of ['screenshots', 'lanes', 'private']) {
    mkdirSync(join(path, dir), { recursive: true });
  }
  writeJson(join(path, 'suite.json'), suite);
  const run: Run = {
    version: 1, id, phase, createdAt: new Date().toISOString(), environment,
    observedBuild: 'unverified', suiteHash: suite.hash, openQuestions: [], fixtures: [], findings: [], limits: [], automated: [], fuzzing: [],
  };
  writeJson(join(path, 'run.json'), run);
  writeJson(join(path, 'results.json'), []);
  writeJson(join(root, 'checkpoint.json'), { phase, runId: id, nextAction: 'Record observed deployment identity; execute approved scenarios.' });
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
      assert.ok(['harness-corrected', 'expected-behavior'].includes(result.resolution.kind) && result.resolution.reason.trim(), 'Explain an allowed resolution without erasing the original attempt.');
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
  writeJson(join(root, 'locked.json'), { version: 1, suiteHash: suite.hash, sourceRun: id, decisionRef, at: new Date().toISOString() });
  writeJson(join(root, 'checkpoint.json'), { phase: 'locked', runId: id, nextAction: 'Generate the standard report; future runs use the locked scenarios.' });
}
