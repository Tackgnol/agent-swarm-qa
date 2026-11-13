---
name: agent-swarm-qa
description: Learn a web app's routes and interactions with Playwright, settle what each capability is for, then build, run and lock a layered regression suite (happy paths, error paths, adversarial attacks) with evidence reports. Use for broad web-app QA, retests of a locked suite and production-readiness checks; not single-bug implementation or a penetration test.
---

# Agent Swarm QA

QA of a whole app outlasts any one conversation, so the effort lives on disk as a **map** of **charters**. A charter is one bounded mission with a checkable end. You hold one charter at a time, close it, and return to the map. The map decides what happens next; the conversation never does.

The **destination** is a locked, repeatable suite for the scope the user agreed: a happy-path **baseline** first, then the **error** and **adversarial** tiers layered on it. The effort moves toward it in this order, and each line is fog until the one before it is done:

1. **Learn interactions:** every route, every interactive element on it, and how to operate each with Playwright. The result is the **inventory**, addressed `route/section/element/action`.
2. **Learn functionality:** what each capability is for, settled with the user, then its happy-path scenarios.
3. **Happy run under scrutiny**, asking the user wherever the app and the agreed intent disagree.
4. **Lock the baseline:** scenarios, operating knowledge and runners, reusable on every later build.
5. **Layer on top:** known error paths, then adversarial scenarios that use everything learned to break the app.

Whatever Playwright cannot do along the way becomes a **barrier** note.

## The loop

Run this loop from the first message until the destination is reached. `<skill>` is the directory holding this file; `<qa-root>` is the product's `.scratch/QA/<project>/`.

1. **Orient.** `node <skill>/scripts/qa.ts map <qa-root>`. Run it at the start of a session, after every close, after any context compaction, and whenever you are unsure what you were doing. With no workspace yet, read [init.md](references/init.md) and create one; that charts the map.
2. **Take one charter.** The one the user named, else the one in hand, else the first on the frontier: `qa.ts claim <qa-root> <charter>`. The claim prints the mission, the reference to read and the completion criterion.
3. **Work that charter.** Read its reference now, and other files only as the charter needs them.
4. **Park everything else.** A new route, odd behavior in another capability, an attack idea, a tooling fix: write it into `charters.json` as a charter or a fog line, then return to the charter in hand.
5. **Close.** `qa.ts close <qa-root> <charter> "<one-line gist>"`. The helper checks the criterion against what is recorded on disk. A refusal lists what is missing: do that work.
6. **Graduate.** Add the charters this close made specifiable, delete the fog lines they replace, rule out what sits beyond the destination. Return to step 1.

Keep looping across charters in the same conversation. End the turn only when the charter in hand needs the user's own answer, when the map says every open charter is blocked on the user, or when the destination is reached. While a HITL charter waits on the user, [swarm workers](references/swarm.md) carry AFK frontier charters.

When you speak to the user, name charters, capabilities and scenarios by their titles, with the ID inside the name where it helps. After a close, say in one line what closed and what is next.

## Charters

| Kind | Mode | Reference | Closes when |
|---|---|---|---|
| `setup` | HITL | [init.md](references/init.md) | The destination is named and the user confirmed the setup |
| `routes` | AFK | [interactions.md](references/interactions.md) | Every route is listed with its sources and identities, and each pending route has an inventory charter |
| `inventory` | AFK | [interactions.md](references/interactions.md) | Every element on the route is operated, or classified with a reason |
| `intent` | HITL | [functionality.md](references/functionality.md) | The capability has a goal and rules the user settled |
| `scenarios`, happy | HITL | [functionality.md](references/functionality.md) | Happy-path scenarios exist and the user confirmed the displayed scope |
| `scenarios`, error | HITL | [error-paths.md](references/error-paths.md) | Same, for the error tier; only after the baseline is locked |
| `scenarios`, adversarial | HITL | [adversarial.md](references/adversarial.md) | Same, for the adversarial tier; only after the baseline is locked |
| `run` | AFK | [execution.md](references/execution.md) | The build is observed, every scenario has a recorded disposition, the report is rendered |
| `lock` | HITL | [lock-and-report.md](references/lock-and-report.md) | The user confirmed the contract and the lock matches the current suite |
| `task` | either | its own mission | Work that unblocks another charter is done |

A **HITL** charter closes only through the user's own answer; an **AFK** charter is the agent's alone. [wayfinding.md](references/wayfinding.md) holds the charter shape, what each close graduates, fog and out-of-scope handling, and how to adopt a workspace that predates the map. Read it before the first edit to `charters.json`.

Conditional references: [barriers.md](references/barriers.md) when Playwright cannot perform a step; [swarm.md](references/swarm.md) before dispatching workers; [embedded-apps.md](references/embedded-apps.md) for iframe or room integrations; [api-contracts.md](references/api-contracts.md) for requested API fuzzing; [to-gherkin.md](references/to-gherkin.md) for a `.feature` export.

## Standing rules

**Credentials.** Tell the user: “Fill `.env.qa` locally. I will never open, print, search, or copy its contents into chat or reports. Trusted local runners load it directly.” Agent-visible files hold aliases and env key names only. This binds every worker, tool inspection and debugging attempt.

**Who owns what.** The user owns product intent: goals, rules, priorities, permitted effects. The agent owns everything else: routes, elements, locators, test design, scheduling. Interview at the level of a capability and only where intent is unclear, contradictory or consequential. Actual consent is an answer the user gave; a recommendation or silence is neither.

**Expectations come from settled intent.** What the app does today is evidence about the implementation. A scenario expects what the rules say, so a mismatch is a finding or a question, and observed behavior never rewrites an expectation.

**Tiers in order.** Before the baseline locks, error paths and attacks are fog: note the idea in one line and keep going. The helper refuses to run them earlier.

**Stay inside the agreed effects.** Act within the mutation policy, on run-owned fixtures, within the request budget and the write budget the user agreed (`qa.ts budget`). Record each write before making it and each fixture right after; build runners on `scripts/harness.cjs`, read-only steps first. A refusal from the session's permission or safety layer stops that work: report it to the user. Stop the affected lane on 429, service instability or unintended data changes. A barrier gets a note and stays in place. Existing user data stays untouched.

**Every stop leaves a report.** Each run, including a failed or interrupted one, renders `report.json`, `report.md` and `report.html` from the same model. First failures, all attempts and missing coverage stay visible; a flaky pass stays inconclusive until its cause is shown.

**The lock approves expectations.** It releases nothing. The recommendation is **ready for the tested scope**, **hold** or **readiness unproven**, and publication, deployment and external notifications each need their own request from the user.
