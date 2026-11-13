# Scrutiny runs, retest and resume

Charter kind `run`. A **scrutiny run** executes the current suite for the first time since it changed: the happy run before the baseline lock, then one run per added tier. A **retest** replays an unchanged locked suite on a new build.

## Scrutiny run

Start only after the current setup, capabilities and scenarios pass approval validation:

```text
node <skill>/scripts/qa.ts run <qa-root> <environment-name> <unique-run-id> first-run
```

The helper snapshots the suite and refuses to overwrite a run. It also refuses error or adversarial scenarios before a baseline lock, and any scenario whose `operations` do not resolve to operated interactions. Record actual deployment identity in `run.json.observedBuild` before execution: exposed build SHA when available, otherwise observed asset/manifest fingerprints with the SHA limitation. A merged PR or dev branch alone proves no deployed identity. Verify an already-open external iframe uses the intended environment too. If the deployment changes, segment into a new run rather than mixing builds.

Finalize the drafted [swarm plan](swarm.md), verify actual resource isolation, and dispatch dependency-ready workers within the available slots. Keep the parent the only writer of suite decisions and aggregate run data; workers write separate lane artifacts for the parent to reconcile. Use actual UI readiness gates and service health, not raw sleeps. A Vite reload, stale Docker runner, file watcher restart, inherited test-only setting or shared output collision is an orchestration failure, not automatically a product defect.

Drive each scenario through its `operations`: look up every address in `interactions/<route>.json`, use the stored locator inside its section, and compare what happens with the recorded effect before judging the expected outcome. Execute the agreed paths in context. Verify durable state and receiving views beyond a toast/2xx. For multi-account cases, verify the distinct receiving identity rather than assuming a second tab is another account. Keep deliberate browser/local fault injection labeled and isolated from real outages. Use existing suites, checking which target and source/runner they actually exercise.

Capture **each screen/state the scenarios name as evidence**, including legal/error/approval/visited states where relevant. Use stable destination/visible-content/font/save readiness. Inspect every captured image for contrast, overlap, clipping and placement; compare later settled geometry if a transition is suspected. Real pointer interactions establish pointer usability; a forced click or keyboard workaround does not clear an overlap. For export/print, inspect the rendered pages, not only the download. Retain transient/failed captures with labels, not overwrites.

## Build a runner without spending writes

A runner is built by trial, and every trial of a writing step leaves data on the target. So build in this order:

1. **Read-only first.** Write and debug the runner up to the first step that writes: navigation, locators, waits, the checks on what is already there. Repeat this part as often as needed; it costs nothing.
2. **One fixture for exploration.** When the steps after a write must be explored, create one fixture, record it, and explore on that same fixture across script runs (save and reuse the browser's storage state under the lane's `private/` folder). A fresh fixture per trial is the mistake to avoid.
3. **Then execute once.** With the runner checked, run the whole scenario from a fresh state. That execution is the attempt.

A scenario whose starting state is random (a generated character, a seeded account) creates the state it needs as its first steps, as the scenario's preconditions say. A runner that only works on a lucky fixture is not replayable.

## Writes are budgeted

The setup records how many test-owned writes the user agreed to (`qa.ts budget <qa-root>` prints it). The count covers every phase, exploration included.

- Before any step that writes, call `qa.spend(qaRoot, lane, what)` (or `qa.ts spend`). It records the write and refuses once the budget is spent. A refusal ends the lane's writing: record `blocked` for what remains and report.
- Right after a write, before anything else can fail, record what it left: `qa.fixture(qaRoot, id, lane, note)`. When cleanup succeeds and is verified, record it again as `done`.
- The parent splits the remaining budget between lanes in each brief and leaves a margin for itself. When the budget is too small for the approved scenarios, that is a question for the user, asked before dispatch.

## Attempts, runner errors and corrections

An **attempt** is one execution of the scenario and what was observed. Attempts are appended and never edited.

- A crash or bug in the runner's own code is not an attempt: log it with `qa.runnerError()` and fix the runner.
- An attempt that failed because the runner drove the app wrongly stays recorded. The next execution is a new attempt carrying `resolution: { kind: 'harness-corrected', reason }`.
- An attempt whose execution was sound but whose own check was wrong, where replaying is unsafe or pointless, is corrected by appending a new record with the corrected status, the evidence from the original execution and `resolution: { kind: 'check-corrected', reason }`. Nothing is re-executed and the original record stays.
- A step that must happen once across all attempts and replays, such as sending a real message, is guarded with `qa.once(laneDir, key)`. If it is unclear whether the step happened, it happened: do not repeat it, and record `inconclusive`.
- At most three attempts per scenario; a further attempt needs a new, stated reason.

## Stops

- **429 or service instability.** One 5xx that the app retries and recovers from is recorded as evidence and the scenario is `inconclusive`; the lane continues. A second 5xx on the same target, any 429, or data changing that the run does not own stops every lane sharing that target until the parent has reconciled them.
- **A refusal from the session's own permission or safety layer** stops the lane. Report exactly what was refused. The parent brings it to the user; neither the worker nor the parent repeats the action in another form.
- **A barrier** blocks the scenario, per [barriers.md](barriers.md).

## When an operation does not resolve

A stored locator that finds nothing, or an element whose effect differs from its record, is **inventory drift** until shown otherwise. Re-inventory that one route per [interactions.md](interactions.md) and compare:

- The element moved, was renamed or restyled and still does the same thing: update its record and continue. Note the repair in the run's `limits`. Approvals are unaffected.
- The element or its effect is gone or different in a way a rule cares about: that is an observation against the scenario, handled below.
- The step now hits a bot check or third-party page: write the [barrier](barriers.md) note and record the scenario as `blocked`.

During a run, workers do not edit inventory files that other lanes read. Each reports its corrections and the `deferred` elements it operated for the first time (address, locator, observed effect); the parent applies them after the lanes finish, as a `task` charter when there are many.

## Unexpected observations

When actual behavior differs from an approved expectation, preserve it as a failed observation. A clear defect does not need the user to reapprove the same requirement. When the expected behavior is genuinely ambiguous, or a new path/side effect is discovered:

1. Record the observation and affected scenario; add a focused open question in `run.json` and the checkpoint, and chart an `intent` charter for it that blocks the lock.
2. Update the editable review document/planning report with the observation, affected scenario IDs and explicitly proposed expectations/open choices; preserve the historical run snapshot. Present the saved document/link and a short summary **before** re-grilling that branch. Follow the document-first steps in [functionality.md](functionality.md); current behavior is not correct by default.
3. Pause dependent cases until the answer; continue independent approved work.
4. If the contract changes, present the semantic delta and updated coverage batch before requesting confirmation of affected content. Reuse settled rules instead of reopening every case. Start a new scrutiny run with the revised snapshot; preserve the earlier run and its questions/results.

Classify each candidate finding as a product defect, a contract gap, a harness mistake or an environment block, and keep the classes separate in the report. Preserve the first failure and make a controlled reproduction with isolated state. Further attempts need a new hypothesis, not a larger retry count. Record failures and later passes together; explain a demonstrated harness correction or expected behavior explicitly. A product fix belongs to a new observed build/run.

## Reusable artifacts

Each lane appends its attempts to `runs/<run-id>/lanes/<lane>/results.json` through the harness; the parent merges them into the run's `results.json`. See `scripts/models.ts` for the exact typed format. Each record has scenario ID, unique attempt number, status, timestamp, actual observations, browser/viewport/locale, actual test boundary, sanitized evidence and screenshot paths with `inspected` flags. Use `blocked`, `not-run` or `inconclusive` with a reason when execution cannot establish the expected result. Missing cases remain in the report as not run.

`boundary` is a stable claim label: use the scenario's approved label only when that boundary was actually exercised, with details in evidence. If a local/mock substitute was used, record its actual lower boundary instead. The report treats a pass/fail at a different boundary as inconclusive for the approved scenario; it preserves the raw attempt. Never copy the approved label merely to bypass this check.

Store stable Playwright automation in `runners/` for every scenario that can be replayed, built on `<skill>/scripts/harness.cjs` from the same `operations` and locators (`examples/runner.cjs`); a locked happy path without a runner records why. Screenshots carry the attempt number in their name, so later attempts never overwrite earlier evidence. A screenshot's `inspected` flag is set only by someone who opened the image. Prefer existing project test infrastructure. Scripts consume env key names through the trusted loader, have owned fixtures/cleanup and separate output paths, and assert the approved behavior. Store execution commands, dependencies and how to run them in a short sibling note or the checkpoint. Avoid saving brittle exploratory snippets as if they were a verified suite; label candidates until replayed. Never change assertions merely to make a run green.

Keep findings in `run.json.findings` and detailed local issue files. Fixtures live in the effort-wide ledger (`writes.json`, through `qa.ts fixture`); copy the run's own into `run.json.fixtures` when merging, so the report shows them. Clean up only ledger-owned fixtures, after the checks that depend on them finish, and compare preserved shared state with its original. When cleanup cannot finish, hand off the IDs, their owner and the next action. Automated test totals and raw contract-fuzzer counts have separate arrays in `run.json`; do not add them to exploratory scenario totals. Private state/traces remain outside shareable evidence. Read the conditional embedded/API references only for those lanes.

## Retest and resume

For the unchanged locked suite:

```text
node <skill>/scripts/qa.ts run <qa-root> <environment-name> <new-run-id> retest
```

The helper checks the entire setup, capability and scenario fingerprint. Changed expectations return to user review and scrutiny; a new build alone does not revoke unchanged scenario approvals. When the inventory changed since the lock, the run starts with a limit saying so: treat the first unresolved operation as drift to repair. Retest every tier in the lock, prior failures included, not only recent fixes. Browser/device/locale sampling follows the approved matrix, not a presumed exhaustive cross-product.

On resume, run `qa.ts map`, then inspect the checkpoint, execution plan, active agent/job state, snapshots, append-only attempts and pending fixture dependencies before restarting anything. Reconcile worker/resource ownership before reassigning a lane; unknown worker state keeps its resources reserved until stopped/settled. Carry earlier passes forward only at an applicable build and boundary, with provenance; otherwise list the missing retest. Never turn an unknown job status into a pass.

At any stop, reconcile worker results, save the next action, retain cleanup debt and run `qa.ts report <qa-root> <run-id>`. A paused or failed run still produces the standard report. If malformed artifacts prevent rendering, preserve them, record the validation error and produce the same report sections manually with readiness unproven; repair only demonstrable data-format mistakes, preserving originals.

Summarize missing execution by capability, cause and next action, with detailed IDs in the report. Not-run cases call for execution; blocked cases call for resolving the named prerequisite. Neither status requires another scenario interview. Ask only when progress depends on a real product decision or changed authorization.
