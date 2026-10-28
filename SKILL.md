---
name: agent-swarm-qa
description: Initialize a reusable QA workspace, interview the user about each mapped path and scenario, run approved journeys with coordinated agents, lock the suite, and produce standard HTML/Markdown/JSON evidence reports. Use for broad web-app QA, canary retests and production-readiness checks; not single-bug implementation or a penetration test.
---

# Agent Swarm QA

Turn exploratory QA into a user-approved, repeatable suite. Follow **Init → Mapping → First run under scrutiny → Lock in → Retest**, producing the same report format throughout. Resume the saved phase rather than restarting the interview. The repository containing this file is the skill source; all product-specific QA data belongs in the product's `.scratch/QA/<project>/`.

## Routing and tools

Read only the phase reference needed now. Bundled helpers use Node >=22.18 with native TypeScript; no runtime packages, browser vendor or tracker are required by the skill. Resolve `scripts/qa.ts` relative to this SKILL.md, not the product repository. Discover available browser, agent and tracker tools instead of assuming names or installed integrations.

| Phase | Reference | Completion gate |
|---|---|---|
| Init | [init.md](references/init.md) | Non-sensitive setup decisions confirmed; required account aliases/env key names allocated; private file and output layout created |
| Mapping | [mapping.md](references/mapping.md) | Each path presented and grilled with its scenarios; inclusion/exclusion and current scenario content approved by the user |
| First run | [execution.md](references/execution.md) | Every approved scenario has an honest disposition; unexpected specification questions resolved or explicitly pending |
| Lock in | [lock-and-report.md](references/lock-and-report.md) | User reviews the report and confirms the scenario contract; a fingerprint records the reviewed baseline |
| Retest / resume | [execution.md](references/execution.md), then [lock-and-report.md](references/lock-and-report.md) | Execute unchanged locked cases on the observed build; review changed expectations before relocking; always regenerate the standard report |
| `to-gherkin` | [to-gherkin.md](references/to-gherkin.md) | Export the current approved specs as reviewable `.feature` drafts; observed results never define expectations |

**Mandatory credential boundary:** tell the user: “Fill `.env.qa` locally. I will never open, print, search, or copy its contents into chat or reports. Trusted local runners load it directly.” Keep only aliases and env key names in agent-visible configuration. This restriction applies to every subagent, tool inspection and debugging attempt. Read [init.md](references/init.md) before credential setup.

Separate **setup decisions**, **private prerequisites**, and **scenario intent**. Private URLs, login parameters and account values belong in the dedicated Init handoff to `.env.qa`, not a browser-matrix, fixture-policy or scenario question. Once allocated, refer to their aliases/key names and check presence locally. A later missing prerequisite gets its own focused handoff; do not reopen unrelated setup questions.

## User scrutiny is part of the product

**Ordered review:** before each path/scenario question, run `node <skill>/scripts/qa.ts next-path <qa-root>` and use its `currentPathId` and scenario IDs. The persisted `review.json` cursor selects the first unfinished path in numeric order and keeps it current until its path disposition and scenarios are approved. Show progress, keep IDs stable, and never select a later path because it looks relevant or easy. Only an explicit user decision/reason may override the order via `focus-path`; unchanged saved approvals remain valid. See Mapping for allocation, batches and resume reconciliation.

**Document before question:** save the current scenario proposal and regenerate its review document/report, then open or link that exact version for the user before asking scenario questions or approval. Send the document link and a short path/scenario summary before opening the question tool. Await document generation/presentation; do not dispatch questions in parallel with it. Repeat this order for revisions and unexpected-behavior discussions. A queued editor panel alone is not presentation: include a readable summary/link in chat. No separate read-receipt confirmation is needed.

Before each scenario question, navigate/scroll the existing review preview to that card (`report.html#case-QA-001`, using the actual ID) and verify its heading is visible. Reuse the preview tab and include the same direct link in the question context. On a new question, move to the new card; after regeneration, restore the current card. If the viewer cannot be controlled, provide the direct link and scenario excerpt and say automatic scrolling was unavailable rather than claiming it happened.

Always review each newly mapped path with the user, even if it looks obvious. Investigate discoverable facts yourself; grill for intent, expectations and tradeoffs. Ask the ready questions for **one path at a time**, give recommendations, wait for answers, then follow dependent branches. Use available user-input tools; never treat elapsed time as an answer. Record actual decisions, not inferred consent. Previously explicit approvals remain valid for unchanged content.

Run neither a proposed scenario nor a revised expectation before its approval. Setup discovery can inspect source and read-only UI within the confirmed boundaries. If the user explicitly approves a displayed batch, record that answer for those exact cases rather than demanding redundant individual approvals. A new target build requires new evidence, not automatically a new specification interview.

## Swarm contract

When delegation is permitted, the parent owns the map, scenario approvals, shared-resource schedule, finding reconciliation and report. Workers receive approved case IDs and exact target, permitted actions, account aliases, fixture namespace, browser/context allocation, output directory and cleanup contract. Workers test and report; product edits or external issue writes require explicit assignment and authorization.

Partition by useful independence: general functionality, authenticated/multi-account collaboration, external-host journeys, and cross-browser/API-contract work when in scope. Respect available slots; serial execution is a valid fallback and must be labeled. Use unique worker artifacts and isolated sessions/fixtures. Tabs in one browser profile share cookies; a shared browser or live room has one operator. Sequence dependent logins, logouts and cleanup. Coordinate the request budget across agents.

Keep general functionality in the suite alongside recent regressions. Verify creation, editing, durable save/reload, navigation, cancellation and dependent views where applicable. Two genuinely distinct accounts are required to prove cross-account behavior. Passing local mocks, HTTP writes and actual deployed journeys establish different things; preserve those boundaries in results.

For embedded-host or room integrations, read [embedded-apps.md](references/embedded-apps.md). For requested CATS/API fuzzing, read [api-contracts.md](references/api-contracts.md) before execution. These are conditional coverage, not compulsory additions to every product.

## Report and stopping rules

Always produce `report.json`, `report.md` and an offline `report.html`: a planning snapshot before execution, and a run report for every completed, failed, paused or interrupted attempt. The [standard report contract](references/lock-and-report.md) defines the sections. Preserve first failures, all attempts, missing coverage, raw fuzzer classifications and cleanup debt. Open the HTML for review when a file/browser preview is available.

Classify confirmed product defects, contract gaps, harness mistakes and environment blocks separately. Confirm candidate findings with a controlled reproduction; additional retries need a new hypothesis. Stop the affected lane on 429, service instability or unintended data changes. A flaky failure followed by a pass is inconclusive until its cause is explained with evidence; it never silently becomes green.

Use the chosen issue destination after duplicate search, within its confirmed write mode. Upload inspected screenshots and embed them as images in remote issues; a local-file link is not an uploaded picture. Keep local drafts when uploads/integrations are unavailable and disclose that limitation.

Clean up only ledger-owned fixtures after dependent checks finish. Compare preserved original room/shared state. If cleanup cannot finish, hand off IDs, ownership and next actions. Never remove existing user data to make a test baseline convenient.

The final recommendation is **ready for the tested scope**, **hold**, or **readiness unproven**, against the user's agreed critical journeys and supported matrix. Missing optional coverage is a limitation, not an automatic blocker. Locking the suite approves expectations, not a release or known failures. No phase authorizes publication, deployment, package release or unrequested external notifications.
