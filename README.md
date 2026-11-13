# Agent Swarm QA

A skill that learns a web app and turns that knowledge into a reviewed, repeatable, layered QA suite.

1. **Learn interactions:** find every route, every interactive element on it, and how to operate each with Playwright. Stored as `route/section/element/action` addresses with locators and observed effects.
2. **Learn functionality:** work out what each capability is for, ask you only about what is genuinely unclear, and derive happy-path scenarios.
3. **Test the happy paths** under scrutiny, asking again wherever the app and the agreed intent disagree.
4. **Lock the baseline:** scenarios, operating knowledge and Playwright runners, reusable on every later build.
5. **Note the barriers:** whatever automation cannot do, such as reCAPTCHA v3, gets a Markdown note with a manual procedure.
6. **Build on top:** known error paths, then an adversarial tier where the agent uses everything it learned to try to break the app. Each layer is run and locked in turn.

Before any of that, **Init** sets up environments, identities and issue storage, with secrets in a private `.env.qa` the agent never opens.

## How it keeps its focus

The effort lives on disk as a **map** of **charters**, not in the conversation. A charter is one bounded mission: inventory this route, settle this capability's intent, run this suite. The agent holds one charter at a time, the helper closes it only when its completion criterion is met on disk, and `qa.ts map` shows what is done, what is takeable next (the frontier), what is still fog and what is out of scope. A long conversation, a context compaction or a fresh session all resume from the same map.

Anything the agent notices that is not the charter in hand is parked as a new charter or a fog line. Later layers stay fog until the earlier ones are locked, and the helper refuses to run error or adversarial scenarios before a baseline lock.

The approach is adapted from Matt Pocock's `wayfinder` skill (destination, map, frontier, fog of war), with tickets replaced by QA charters whose completion is checked by code. The interview style comes from his `grilling` skill. See [the map reference](references/wayfinding.md).

## Swarm

Where subagents are available, independent charters and run lanes go to workers: one route inventory per worker, separate browser contexts, accounts and fixtures, shared resources scheduled to avoid interference. The parent coordinates, reconciles evidence and owns the report. See [the swarm workflow](references/swarm.md). Without subagents the skill runs serially and says so.

See [SKILL.md](SKILL.md) for the agent workflow. QA reporting is implemented here without CDN dependencies.

## Install

You need **Node.js 22.18 or newer** and an agent that can read local skill files and run commands. Live web QA needs **Playwright** available to the agent: Playwright MCP browser tools, the product's own Playwright install, or one in the environment. The skill stores everything it learns as Playwright locators. Parallel execution needs subagent support. Git is required for the manual installation below. No `npm install` is needed to use the skill's helpers; Playwright and issue-tracker connections are configured separately in your agent.

### Codex: ask the built-in installer

Paste this into a Codex chat:

```text
Use $skill-installer to install the skill from Tackgnol/agent-swarm-qa.
Use ref master, path . (the repository root), and name agent-swarm-qa.
```

The explicit ref matches this repository's default branch. If the skill is already installed, update that copy rather than installing a second one.

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

### Claude Code

Clone the repository into your personal skills directory, `~/.claude/skills/agent-swarm-qa` (all projects), or into a product's `.claude/skills/agent-swarm-qa` (that project only). See the [official Claude Code skills guide](https://code.claude.com/docs/en/skills).

**Windows / PowerShell:**

```powershell
$skillRoot = Join-Path $env:USERPROFILE '.claude\skills'
New-Item -ItemType Directory -Path $skillRoot -Force | Out-Null
git clone https://github.com/Tackgnol/agent-swarm-qa.git (Join-Path $skillRoot 'agent-swarm-qa')
```

**macOS / Linux:**

```bash
mkdir -p "$HOME/.claude/skills"
git clone https://github.com/Tackgnol/agent-swarm-qa.git "$HOME/.claude/skills/agent-swarm-qa"
```

Invoke it with `/agent-swarm-qa`, or describe a QA task and Claude Code loads it from the description. If `~/.claude/skills` did not exist when your session started, restart Claude Code so the new directory is picked up. Claude Code's subagents and the Playwright MCP integration cover the swarm and live-browser parts.

### GitHub Copilot

Copilot agent skills work in Copilot CLI, agent mode in VS Code and the Copilot cloud agent. Personal skills go in `~/.copilot/skills/agent-swarm-qa`; project skills go in the product repository's `.github/skills/agent-swarm-qa`. Copilot also reads `~/.agents/skills` and `~/.claude/skills`, so an existing Codex or Claude Code clone already works; do not clone a second copy. See the [GitHub Copilot skills guide](https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/create-skills).

**Windows / PowerShell:**

```powershell
$skillRoot = Join-Path $env:USERPROFILE '.copilot\skills'
New-Item -ItemType Directory -Path $skillRoot -Force | Out-Null
git clone https://github.com/Tackgnol/agent-swarm-qa.git (Join-Path $skillRoot 'agent-swarm-qa')
```

**macOS / Linux:**

```bash
mkdir -p "$HOME/.copilot/skills"
git clone https://github.com/Tackgnol/agent-swarm-qa.git "$HOME/.copilot/skills/agent-swarm-qa"
```

Restart Copilot CLI or reload VS Code, then ask Copilot to use the `agent-swarm-qa` skill. The cloud agent only sees project skills committed under `.github/skills/`, and it cannot run the local `.env.qa` credential flow, so prefer Copilot CLI or VS Code for authenticated QA.

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

> Use $agent-swarm-qa to chart QA for this app on canary. Learn the routes and interactions, settle what each capability is for with me, then run and lock the happy paths before adding error paths and adversarial testing.

To continue later, in the same or a new conversation: “Continue the QA map.” To see where things stand yourself, open `<qa-root>/map.md`.

Helpers run relative to this skill's location:

```text
node scripts/qa.ts init <product-root> <project-slug> [--in <directory>]
node scripts/qa.ts map <qa-root> [all]
node scripts/qa.ts claim <qa-root> <charter> [claimant]
node scripts/qa.ts close <qa-root> <charter> "<one-line gist>"
node scripts/qa.ts release <qa-root> <charter>
node scripts/qa.ts rule-out <qa-root> <charter> "<reason>"
node scripts/qa.ts chart <qa-root>
node scripts/qa.ts chart-add <qa-root> <file.json>
node scripts/qa.ts gist <qa-root> <charter> "<corrected gist>"
node scripts/qa.ts budget <qa-root> [<limit> "<unit>"]
node scripts/qa.ts spend <qa-root> <who> "<what>"
node scripts/qa.ts fixture <qa-root> <id> <owner> "<note>" [pending|done|handed-off]
node scripts/qa.ts env-template <qa-root>
node scripts/qa.ts prepare-env <qa-root>
node scripts/qa.ts check-env <qa-root>
node scripts/qa.ts interactions <qa-root> [route]
node scripts/qa.ts route-status <qa-root> <route> <status> [reason]
node scripts/qa.ts lint-scenarios <qa-root> [QA-ID...]
node scripts/qa.ts wire-scenarios <qa-root>
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

`examples/` contains non-sensitive **unapproved** shapes: setup, a map of charters, routes, one route's interactions, a capability, a scenario, a barrier note and a scenario runner. Runners build on the shipped harness, `scripts/harness.cjs`: a tracked browser session, attempt-numbered screenshots, append-only attempts, budgeted writes and fixture records. Adapt them to the real product; copying an example is not user approval. Fill results according to [models.ts](scripts/models.ts). `report` without a run ID produces a planning report before execution is possible.

The `.env.qa` boundary is literal: the agent never inspects the file; trusted local code necessarily loads it to use credentials. Child stdout/stderr receive literal-value redaction, but encoded values and screenshots need collection-time protection. The file is local plaintext, not a vault. Users enter values locally rather than in chat.

Private host URLs use `environment.hostUrlEnv` references; additional private connection parameters use `privateEnvKeys`. Both join account keys in preparation, template generation and presence checks. For Owlbear, the Init handoff can prepare `OWLBEAR_URL` and numbered `OWLBEAR_LOGIN_1` / `OWLBEAR_PASS_1` slots. Private prerequisite setup stays separate from scenario, browser-matrix and fixture-policy interviews.

QA output lives under the product's `.scratch/QA/<project>/` by default, or under another directory given with `--in` (a read-only checkout, a cloud session); the product's path is then recorded in `config.json`. Init also creates `runners/lib/app.cjs`, a starter for the app's own runner helpers, and a `private/` folder for saved sessions and other runner state. Existing workspaces, credentials and run IDs are not overwritten. Local report generation, locking a contract and selecting an issue tracker do not authorize deployment, publication or unrelated external writes.

### What you are asked, and what you are not

You own product intent; the agent owns routes, elements, locators and test design. The route and element inventory is never interviewed. You are asked about capabilities: the goal, the rules, what blocks a release, and how the app should respond where that is unstated. Capabilities store `intent: { goal, rules, risks }`; the report shows these briefs and coverage counts before detailed scenarios, and one confirmation covers a displayed batch.

Approvals fingerprint exactly what you confirmed. Scenario `operations` and capability `routes` are operating knowledge outside that fingerprint, so the agent can repair a moved button without coming back to you, while a changed expectation always does.

### Tiers and locks

Each scenario has a `tier`: `happy`, `error` or `adversarial`; scenarios from older workspaces without one count as happy. A lock records the scenario count per tier and a fingerprint of the inventory. On a retest, a changed inventory is reported as drift to repair before any failure is attributed to the product. An adversarial scenario must name the rule it tries to break, so its result is always “the rule held” or “the rule broke”.

Adversarial testing here means abusing the app's own features with legitimate QA accounts inside the agreed effects and request budget. It is not a penetration test, a load test or an attempt to defeat bot checks.

### Trials

[trials/](trials/) records runs of the skill against real apps: what held, what broke, and the status of each gap found. The first is [scvmrack on production](trials/2026-11-scvmrack.md).

### Writes are budgeted

When the setup allows test-owned writes, the user agrees how many the whole effort may make, inventory and exploration included. Every write is recorded before it is made (`spend`, or `qa.spend()` in a runner), and the helper refuses once the budget is gone, so a lane stops instead of overshooting. Test data left on the target is recorded with `fixture` and shown on the map. This came out of the first live trial, where exploration created more production data than agreed.

### Existing workspaces

A workspace created before the map keeps working: approvals, runs and locks are unchanged. Ask the agent to adopt it; `qa.ts chart <qa-root>` charts the opening, and the agent closes what the recorded state already satisfies.

## Export approved specs to Gherkin

Ask `$agent-swarm-qa to-gherkin` with the existing QA workspace. The command creates one `.feature` draft per included path and a traceability manifest under `exports/gherkin/<export-id>/`. It uses approved preconditions, actions and expectations only. Observed results, failures and reports never define the output, and no QA run is required. Existing exports are preserved. See [the export workflow](references/to-gherkin.md).

The output has no executable step definitions or automation claims. Runtime export needs no npm dependencies; the official Cucumber parser is a development-only dependency used to verify feature syntax and round-trip preservation in tests.

## Offline report preview

Run `npm run demo` to generate a visual report under this repository's ignored `.scratch/` folder. Every observation, approval and count is labeled synthetic; it sends no network requests and tests no real product. Each invocation creates a new run without overwriting history.

For local development, run `npm ci` in the skill repository first. Contributor checks are `npm test` and `npm run typecheck`; normal skill use and the offline preview do not need these development dependencies.

## License

[MIT](LICENSE) — copyright 2026 Adam Kościelniak.
