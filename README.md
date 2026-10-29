# Agent Swarm QA

A skill for turning exploratory web-app QA into a reviewed, repeatable suite.

1. **Init:** choose environments, guest/authenticated paths, account roles, issue storage and coverage. Keep secrets in a private `.env.qa` that the agent never opens.
2. **Mapping:** establish capability goals, behavior rules and risks; derive tests and confirm the displayed scope as a batch. Ask about genuine uncertainty rather than walking through every case.
3. **First run under scrutiny:** execute only approved scenarios, preserve evidence, ask again when expectations are ambiguous, and retain useful TS/JS runners.
4. **Lock in:** review a visual report and record the agreed scenario fingerprint. Known failures remain failures.
5. **Retest:** run the same contract against a new observed build and always produce HTML, Markdown and JSON reports.

Mapping also builds a swarm execution plan. Available subagents receive bounded assignments with approved cases, account/session and fixture allocations, dependencies and separate evidence outputs. Independent work runs concurrently; shared browsers, accounts and rooms are scheduled to avoid interference. The parent coordinates, reconciles evidence and owns the final report. See [the swarm workflow](references/swarm.md).

See [SKILL.md](SKILL.md) for the agent workflow. The interview-tree approach is adapted from the local `grilling`/`grill-me` skills; the visual review idea is inspired by `improve-codebase-architecture`. QA-specific reporting is implemented here without CDN dependencies.

## Install

You need **Node.js 22.18 or newer** and an agent that can read local skill files and run commands. Live web QA also needs browser-control tools; parallel execution needs subagent support. Without subagents, the skill can run serially and report that limitation. Git is required for the manual installation below. No `npm install` is needed to use the skill's helpers; browser tools and issue-tracker connections are configured separately in your agent.

### Codex: ask the built-in installer

Paste this into a Codex chat:

```text
Use $skill-installer to install the skill from Tackgnol/agent-swarm-qa.
Use ref codex/agent-swarm-qa, path . (the repository root), and name agent-swarm-qa.
```

The explicit ref matches this repository's current default branch. If the skill is already installed, update that copy rather than installing a second one.

### Codex: manual installation with Git

Choose this method if you want to update with `git pull`. The commands install the whole repository as one personal skill under `~/.agents/skills/agent-swarm-qa`, a user skill location documented in the [official OpenAI skill guide](https://learn.chatgpt.com/docs/build-skills#where-codex-loads-local-skills).

**Windows / PowerShell:**

```powershell
$skillRoot = Join-Path $env:USERPROFILE '.agents\skills'
New-Item -ItemType Directory -Path $skillRoot -Force | Out-Null
git clone https://github.com/Tackgnol/agent-swarm-qa.git (Join-Path $skillRoot 'agent-swarm-qa')
```

**macOS / Linux:**

```bash
mkdir -p "$HOME/.agents/skills"
git clone https://github.com/Tackgnol/agent-swarm-qa.git "$HOME/.agents/skills/agent-swarm-qa"
```

Choose one installation method. If the destination already exists, keep it and follow the update guidance below. If you already have a working copy in another skill directory, update that copy rather than adding a duplicate.

Codex detects newly installed skills automatically. If it does not appear, restart Codex, then invoke `$agent-swarm-qa`. See the [official installation guidance](https://learn.chatgpt.com/docs/build-skills#install-curated-skills-for-local-use).

### Other skill-compatible agents

Place the repository in that agent's documented skills directory as `agent-swarm-qa`, or explicitly point it at this repository's `SKILL.md`. Keep `SKILL.md`, `scripts/`, `references/`, `examples/`, `agents/` and `LICENSE` together. Tool availability and automatic discovery depend on the agent; installing the files alone does not add browser, subagent or tracker tools.

### Update an existing installation

For a Git clone installed with the commands above:

```powershell
# Windows / PowerShell
git -C (Join-Path $env:USERPROFILE '.agents\skills\agent-swarm-qa') pull --ff-only
```

```bash
# macOS / Linux
git -C "$HOME/.agents/skills/agent-swarm-qa" pull --ff-only
```

Use your actual install path if it differs. If Git reports local changes or diverged history, preserve them and resolve the difference before updating; these commands do not force an overwrite. Installer/download copies may not contain `.git`: back up the existing copy, obtain the updated repository, then replace the skill files in the same location. Product QA workspaces and `.env.qa` files remain in the product's `.scratch/QA/` directory and should be preserved.

For an ongoing QA chat, ask the agent to reload `SKILL.md` and the relevant references while preserving its current workspace, approvals and results. Restart Codex if the updated skill is not discovered.

## Use

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

For local development, run `npm ci` in the skill repository first. Contributor checks are `npm test` and `npm run typecheck`; normal skill use and the offline preview do not need these development dependencies.

## License

[MIT](LICENSE) — copyright 2026 Adam Kościelniak.
