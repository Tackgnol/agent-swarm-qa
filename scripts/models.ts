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
export type PathEntry = {
  id: string; title: string; route: string; scenarioIds: string[];
  disposition: 'pending' | 'included' | 'excluded'; reason: string; approval: Approval | null;
};
export type PathMap = { version: 1; paths: PathEntry[] };
export type Scenario = {
  id: string; pathId: string; title: string; identities: string[]; critical: boolean;
  preconditions: string[]; steps: string[]; expected: string[];
  boundary: string; evidence: string[]; cleanup: string[]; approval: Approval | null;
};
export type Suite = { config: Config; map: PathMap; scenarios: Scenario[]; hash: string };
export type Run = {
  version: 1; id: string; phase: 'planning' | 'first-run' | 'retest'; createdAt: string;
  environment: string; observedBuild: string; suiteHash: string;
  openQuestions: string[];
  fixtures: { id: string; owner: string; cleanup: 'pending' | 'done' | 'handed-off'; note: string }[];
  findings: { id: string; title: string; kind: string; impact: string; scenarioIds: string[]; issueUrl?: string }[];
  limits: string[];
  automated: { name: string; boundary: string; passed: number; failed: number; skipped: number; log: string }[];
  fuzzing: { name: string; executed: number; rawErrors: number; rawWarnings: number; confirmedDefects: number; log: string }[];
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
