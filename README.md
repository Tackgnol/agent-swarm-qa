# Agent Swarm QA

A skill for turning exploratory web-app QA into a reviewed, repeatable suite.

1. **Init:** choose environments, guest/authenticated paths, account roles, issue storage and coverage. Keep secrets in a private `.env.qa` that the agent never opens.
2. **Mapping:** establish capability goals, behavior rules and risks; derive tests and confirm the displayed scope as a batch. Ask about genuine uncertainty rather than walking through every case.
3. **First run under scrutiny:** execute only approved scenarios, preserve evidence, ask again when expectations are ambiguous, and retain useful TS/JS runners.
4. **Lock in:** review a visual report and record the agreed scenario fingerprint. Known failures remain failures.
5. **Retest:** run the same contract against a new observed build and always produce HTML, Markdown and JSON reports.

See [SKILL.md](SKILL.md) for the agent workflow. The interview-tree approach is adapted from the local `grilling`/`grill-me` skills; the visual review idea is inspired by `improve-codebase-architecture`. QA-specific reporting is implemented here without CDN dependencies.

## Use

Install this folder as `agent-swarm-qa` in your agent's skills directory, or point the agent at `SKILL.md` in this repository. The installed skill must retain `scripts/`, `references/`, `examples/` and `agents/`. Runtime helpers need Node 22.18 or newer and no npm install. Development uses `npm ci`, `npm test` and `npm run typecheck`.

Example request:

> Use $agent-swarm-qa to initialize QA for this app. Discuss feature intent and unresolved decisions with me, derive the cases, confirm the coverage summary, then test on canary with screenshots and local findings.

Helpers run relative to this skill's location:

```text
node scripts/qa.ts init <product-root> <project-slug>
node scripts/qa.ts env-template <qa-root>
node scripts/qa.ts prepare-env <qa-root>
node scripts/qa.ts check-env <qa-root>
node scripts/qa.ts next-path-id <qa-root>
node scripts/qa.ts next-path <qa-root>
node scripts/qa.ts approve <qa-root> setup <actual-user-decision-reference>
node scripts/qa.ts approve-batch <qa-root> <actual-scope-decision-reference> PATH-001 PATH-002
node scripts/qa.ts run <qa-root> canary <run-id> first-run
node scripts/with-qa-env.ts <qa-root>/.env.qa <qa-root>/runners/<trusted-runner.ts>
node scripts/qa.ts report <qa-root> <run-id>
node scripts/qa.ts lock <qa-root> <run-id> <actual-lock-decision-reference>
node scripts/qa.ts run <qa-root> canary <new-run-id> retest
node scripts/qa.ts to-gherkin <qa-root> <unique-export-id>
```

`examples/` contains non-sensitive **unapproved** config, mapping and scenario shapes. Adapt them to the real product; copying an example is not user approval. Fill results according to [models.ts](scripts/models.ts). `report` without a run ID produces a planning report before execution is possible.

The `.env.qa` boundary is literal: the agent never inspects the file; trusted local code necessarily loads it to use credentials. Child stdout/stderr receive literal-value redaction, but encoded values and screenshots need collection-time protection. The file is local plaintext, not a vault. Users enter values locally rather than in chat.

Private host URLs use `environment.hostUrlEnv` references; additional private connection parameters use `privateEnvKeys`. Both join account keys in preparation, template generation and presence checks. For Owlbear, the Init handoff can prepare `OWLBEAR_URL` and numbered `OWLBEAR_LOGIN_1` / `OWLBEAR_PASS_1` slots. Private prerequisite setup stays separate from scenario, browser-matrix and fixture-policy interviews.

QA output lives under the product's `.scratch/QA/<project>/`, not this skill repository. Existing workspaces, credentials and run IDs are not overwritten. Local report generation, locking a contract and selecting an issue tracker do not authorize deployment, publication or unrelated external writes.

The interview is about capabilities, not a queue of QA IDs. New map entries can store `intent: { goal, rules, risks }`; the report shows these briefs and coverage counts before detailed cases. Existing small paths can share a capability discussion and one scope confirmation without renumbering. Unchanged saved approvals remain valid.

Approval bookkeeping uses a persisted numeric frontier; batches follow that order and fingerprint their exact paths/cases. New paths append after the highest assigned number. A user-authorized `focus-path <qa-root> <path-id> <decision-ref> <reason>` records a deliberate order change and then returns to earlier unfinished work. Individual `approve` commands still work for existing workspaces. The frontier is not a requirement to ask a question for every path or case; incomplete execution coverage is not an interview backlog.

## Export approved specs to Gherkin

Ask `$agent-swarm-qa to-gherkin` with the existing QA workspace. The command creates one `.feature` draft per included path and a traceability manifest under `exports/gherkin/<export-id>/`. It uses approved preconditions, actions and expectations only. Observed results, failures and reports never define the output, and no QA run is required. Existing exports are preserved. See [the export workflow](references/to-gherkin.md).

The output has no executable step definitions or automation claims. Runtime export needs no npm dependencies; the official Cucumber parser is a development-only dependency used to verify feature syntax and round-trip preservation in tests.

## Offline report preview

Run `npm run demo` to generate a visual report under this repository's ignored `.scratch/` folder. Every observation, approval and count is labeled synthetic; it sends no network requests and tests no real product. Each invocation creates a new run without overwriting history.
