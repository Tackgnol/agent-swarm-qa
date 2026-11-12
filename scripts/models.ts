export type Status = 'passed' | 'failed' | 'blocked' | 'not-run' | 'inconclusive';
export type Approval = { decisionRef: string; at: string; contentHash: string };
export type Config = {
  version: 1;
  project: string;
  environments: { name: string; appUrl: string; apiUrl?: string; hostUrl?: string; hostUrlEnv?: string }[];
  privateEnvKeys?: string[];
  identities: { alias: string; kind: 'guest' | 'authenticated'; role: string; envKeys: string[] }[];
  issues: { provider: 'undecided' | 'local' | 'github' | 'linear' | 'other'; destination: string; mode: 'undecided' | 'local' | 'draft' | 'create' };
  coverage: { browsers: string[]; locales: string[]; viewports: string[] };
  mutationPolicy: 'undecided' | 'read-only' | 'owned-fixtures';
  setupApproval: Approval | null;
};
export type Tier = 'happy' | 'error' | 'adversarial';
export type PathEntry = {
  id: string; title: string; route: string; scenarioIds: string[];
  /** Route IDs from routes.json this capability spans. Agent-owned; not part of the approved content. */
  routes?: string[];
  intent?: { goal: string; rules: string[]; risks: string[] };
  disposition: 'pending' | 'included' | 'excluded'; reason: string; approval: Approval | null;
};
export type PathMap = { version: 1; paths: PathEntry[] };
export type ReviewCursor = {
  version: 1; order: string[]; currentPathId: string | null; overridePathId: string | null;
  pendingPathIds: string[]; completedPathIds: string[]; scenarioIds: string[];
  jumps: { from: string | null; to: string; decisionRef: string; reason: string; at: string }[];
};
export type Scenario = {
  id: string; pathId: string; title: string; identities: string[]; critical: boolean;
  preconditions: string[]; steps: string[]; expected: string[];
  boundary: string; evidence: string[]; cleanup: string[]; approval: Approval | null;
  /** Layer this scenario belongs to; absent means the happy-path baseline. */
  tier?: Tier;
  /** The capability rule this scenario exercises; required for the adversarial tier. */
  rule?: string;
  /** Ordered interaction addresses (route/section/element/action) the steps drive. Agent-owned; not part of the approved content. */
  operations?: string[];
};
export type Suite = { config: Config; map: PathMap; scenarios: Scenario[]; hash: string };
export type Run = {
  version: 1; id: string; phase: 'planning' | 'first-run' | 'retest'; createdAt: string;
  environment: string; observedBuild: string; suiteHash: string;
  openQuestions: string[];
  fixtures: { id: string; owner: string; cleanup: 'pending' | 'done' | 'handed-off'; note: string }[];
  findings: { id: string; title: string; kind: string; impact: string; scenarioIds: string[]; issueUrl?: string }[];
  limits: string[];
  /** Fingerprint of the inventory when the run started. */
  interactionsHash?: string;
  automated: { name: string; boundary: string; passed: number; failed: number; skipped: number; log: string }[];
  fuzzing: { name: string; executed: number; rawErrors: number; rawWarnings: number; confirmedDefects: number; log: string }[];
};
export type Lock = {
  version: 1; suiteHash: string; sourceRun: string; decisionRef: string; at: string;
  tiers?: Record<Tier, number>; interactionsHash?: string;
};
export type Route = {
  id: string; pattern: string; title: string;
  /** Where the route was found: source, crawl, sitemap, user. */
  sources: string[];
  /** Identity aliases that can reach it. */
  identities: string[];
  status: 'pending' | 'inventoried' | 'unreachable' | 'excluded'; reason: string;
};
export type RouteInventory = { version: 1; routes: Route[] };
export type Interaction = {
  section: string; element: string; action: string; role: string;
  /** Playwright locator expression, scoped inside its section's locator. Never contains private values. */
  locator: string;
  identities?: string[];
  status: 'pending' | 'operated' | 'skipped' | 'barrier';
  /** Observed effect when operated; the reason when skipped or behind a barrier. */
  effect: string;
  /** Barrier note ID (barriers/<id>.md) when status is barrier. */
  barrier?: string;
};
export type RouteInteractions = {
  version: 1; route: string; capturedAt: string;
  sections: { id: string; title: string; locator: string }[];
  interactions: Interaction[];
};
export type CharterKind = 'setup' | 'routes' | 'inventory' | 'intent' | 'scenarios' | 'run' | 'lock' | 'task';
export type Charter = {
  id: string; name: string; kind: CharterKind; mode: 'HITL' | 'AFK'; mission: string;
  /** What the charter is about: a route ID, capability path IDs, or a run ID, depending on kind. */
  subjects?: string[];
  tier?: Tier;
  blockedBy: string[];
  status: 'open' | 'closed' | 'out-of-scope';
  claimedBy: string | null;
  /** One line: the outcome when closed, the reason when out of scope. Detail lives in the artifact the charter produced. */
  gist: string;
};
export type Chart = {
  version: 1; destination: string; notes: string[]; fog: string[]; outOfScope: string[]; charters: Charter[];
};
export type Result = {
  scenarioId: string; attempt: number; status: Status; at: string; actual: string;
  browser: string; viewport: string; locale: string; boundary: string;
  screenshots: { path: string; caption: string; inspected: boolean }[];
  evidence: string[];
  resolution?: { kind: 'harness-corrected' | 'expected-behavior'; reason: string };
};
export type Report = {
  version: 1; generatedAt: string; project: string; run: Run;
  target: Config['environments'][number]; suiteHash: string;
  recommendation: 'ready-for-tested-scope' | 'hold' | 'readiness-unproven'; reasons: string[];
  counts: Record<Status, number>;
  cases: { scenario: Scenario; status: Status; attempts: Result[] }[];
  paths: PathEntry[];
  coverage: Config['coverage'];
  identities: Pick<Config['identities'][number], 'alias' | 'kind' | 'role'>[];
  issueStorage: Config['issues'];
  excludedPaths: PathEntry[];
};
