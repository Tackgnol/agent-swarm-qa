# Agent Swarm QA

A skill for turning exploratory web-app QA into a reviewed, repeatable suite.

1. **Init:** choose environments, guest/authenticated paths, account roles, issue storage and coverage. Keep secrets in a private `.env.qa` that the agent never opens.
2. **Mapping:** discover journeys, present each path and proposed scenarios, and grill the decisions with the user.
3. **First run under scrutiny:** execute only approved scenarios, preserve evidence, ask again when expectations are ambiguous, and retain useful TS/JS runners.
4. **Lock in:** review a visual report and record the agreed scenario fingerprint. Known failures remain failures.
5. **Retest:** run the same contract against a new observed build and always produce HTML, Markdown and JSON reports.

See [SKILL.md](SKILL.md) for the agent workflow. The interview-tree approach is adapted from the local `grilling`/`grill-me` skills; the visual review idea is inspired by `improve-codebase-architecture`. QA-specific reporting is implemented here without CDN dependencies.

## Use

Install this folder as `agent-swarm-qa` in your agent's skills directory, or point the agent at `SKILL.md` in this repository. The installed skill must retain `scripts/`, `references/`, `examples/` and `agents/`. Runtime helpers need Node 22.18 or newer and no npm install. Development uses `npm ci`, `npm test` and `npm run typecheck`.

Example request:

> Use $agent-swarm-qa to initialize QA for this app. Review each path and scenario with me, test the approved suite on canary, keep screenshots, and store confirmed findings locally.

Helpers run relative to this skill's location:

```text
node scripts/qa.ts init <product-root> <project-slug>
node scripts/qa.ts env-template <qa-root>
node scripts/qa.ts prepare-env <qa-root>
node scripts/qa.ts check-env <qa-root>
node scripts/qa.ts approve <qa-root> setup <actual-user-decision-reference>
node scripts/qa.ts approve <qa-root> path:PATH-001 <actual-user-decision-reference>
node scripts/qa.ts approve <qa-root> QA-001 <actual-user-decision-reference>
node scripts/qa.ts run <qa-root> canary <run-id> first-run
node scripts/with-qa-env.ts <qa-root>/.env.qa <qa-root>/runners/<trusted-runner.ts>
node scripts/qa.ts report <qa-root> <run-id>
node scripts/qa.ts lock <qa-root> <run-id> <actual-lock-decision-reference>
node scripts/qa.ts run <qa-root> canary <new-run-id> retest
```

`examples/` contains non-sensitive **unapproved** config, mapping and scenario shapes. Adapt them to the real product; copying an example is not user approval. Fill results according to [models.ts](scripts/models.ts). `report` without a run ID produces a planning report before execution is possible.

The `.env.qa` boundary is literal: the agent never inspects the file; trusted local code necessarily loads it to use credentials. Child stdout/stderr receive literal-value redaction, but encoded values and screenshots need collection-time protection. The file is local plaintext, not a vault. Users enter values locally rather than in chat.

Private host URLs use `environment.hostUrlEnv` references; additional private connection parameters use `privateEnvKeys`. Both join account keys in preparation, template generation and presence checks. For Owlbear, the Init handoff can prepare `OWLBEAR_URL` and numbered `OWLBEAR_LOGIN_1` / `OWLBEAR_PASS_1` slots. Private prerequisite setup stays separate from scenario, browser-matrix and fixture-policy interviews.

QA output lives under the product's `.scratch/QA/<project>/`, not this skill repository. Existing workspaces, credentials and run IDs are not overwritten. Local report generation, locking a contract and selecting an issue tracker do not authorize deployment, publication or unrelated external writes.

## Offline report preview

Run `npm run demo` to generate a visual report under this repository's ignored `.scratch/` folder. Every observation, approval and count is labeled synthetic; it sends no network requests and tests no real product. Each invocation creates a new run without overwriting history.
