# First run, retest and resume

## First run under scrutiny

Start only after the current setup/map/scenarios pass approval validation:

```text
node <skill>/scripts/qa.ts run <qa-root> <environment-name> <unique-run-id> first-run
```

The helper snapshots the suite and refuses to overwrite a run. Record actual deployment identity in `run.json.observedBuild` before execution: exposed build SHA when available, otherwise observed asset/manifest fingerprints with the SHA limitation. A merged PR or dev branch alone proves no deployed identity. Verify an already-open external iframe uses the intended environment too. If the deployment changes, segment into a new run rather than mixing builds.

Finalize the mapped [swarm plan](swarm.md), verify actual resource isolation, and dispatch dependency-ready workers within the available slots. Keep the parent the only writer of suite decisions and aggregate run data; workers write separate lane artifacts for the parent to reconcile. Use actual UI readiness gates and service health, not raw sleeps. A Vite reload, stale Docker runner, file watcher restart, inherited test-only setting or shared output collision is an orchestration failure, not automatically a product defect.

Execute the agreed paths in context. Verify durable state and receiving views beyond a toast/2xx. For multi-account cases, verify the distinct receiving identity rather than assuming a second tab is another account. Keep deliberate browser/local fault injection labeled and isolated from real outages. Use existing suites, checking which target and source/runner they actually exercise.

Capture **each screen/state requested in the map**, including legal/error/approval/visited states where relevant. Use stable destination/visible-content/font/save readiness. Inspect every captured image for contrast, overlap, clipping and placement; compare later settled geometry if a transition is suspected. Real pointer interactions establish pointer usability; a forced click or keyboard workaround does not clear an overlap. For export/print, inspect the rendered pages, not only the download. Retain transient/failed captures with labels, not overwrites.

## Unexpected observations

When actual behavior differs from an approved expectation, preserve it as a failed observation. A clear defect does not need the user to reapprove the same requirement. When the expected behavior is genuinely ambiguous, or a new path/side effect is discovered:

1. Record the observation and affected scenario; add a focused open question in `run.json` and the checkpoint.
2. Update the editable review document/planning report with the observation, affected scenario IDs and explicitly proposed expectations/open choices; preserve the historical run snapshot. Present the saved document/link and a short summary **before** re-grilling that branch. Follow Mapping's document-first gate; current behavior is not correct by default.
3. Pause dependent cases until the answer; continue independent approved work.
4. If the contract changes, present the semantic delta and updated coverage batch before requesting confirmation of affected content. Reuse settled rules instead of reopening every case. Start a new scrutiny run with the revised snapshot; preserve the earlier run and its questions/results.

Stop the affected lane on 429, unhealthy service behavior or unintended data changes. Preserve the first failure and make a controlled reproduction with isolated state. Further attempts need a new hypothesis, not a larger retry count. Record failures and later passes together; explain a demonstrated harness correction or expected behavior explicitly. A product fix belongs to a new observed build/run.

## Reusable artifacts

Append results to `results.json`; see `scripts/models.ts` for the exact typed format. Each record has scenario ID, unique attempt number, status, timestamp, actual observations, browser/viewport/locale, actual test boundary, sanitized evidence and screenshot paths with `inspected` flags. Use `blocked`, `not-run` or `inconclusive` with a reason when execution cannot establish the expected result. Missing cases remain in the report as not run.

`boundary` is a stable claim label: use the scenario's approved label only when that boundary was actually exercised, with details in evidence. If a local/mock substitute was used, record its actual lower boundary instead. The report treats a pass/fail at a different boundary as inconclusive for the approved scenario; it preserves the raw attempt. Never copy the approved label merely to bypass this check.

Store stable TS/JS automation in `runners/` when a journey can be replayed. Prefer existing project test infrastructure. Scripts consume env key names through the trusted loader, have owned fixtures/cleanup and separate output paths, and assert the approved behavior. Store execution commands, dependencies and how to run them in a short sibling note or the checkpoint. Avoid saving brittle exploratory snippets as if they were a verified suite; label candidates until replayed. Never change assertions merely to make a run green.

Keep findings in `run.json.findings` and detailed local issue files. Retain fixture ownership and cleanup in `run.json.fixtures`. Automated test totals and raw contract-fuzzer counts have separate arrays in `run.json`; do not add them to exploratory scenario totals. Private state/traces remain outside shareable evidence. Read the conditional embedded/API references only for those lanes.

## Retest and resume

For the unchanged locked suite:

```text
node <skill>/scripts/qa.ts run <qa-root> <environment-name> <new-run-id> retest
```

The helper checks the entire config/map/scenario fingerprint. Changed expectations return to user review and scrutiny; a new build alone does not revoke unchanged scenario approvals. Retest prior failures and the agreed general-functionality suite, not only recent fixes. Browser/device/locale sampling follows the approved matrix, not a presumed exhaustive cross-product.

On resume, inspect the checkpoint, execution plan, active agent/job state, snapshots, append-only attempts and pending fixture dependencies before restarting anything. Reconcile worker/resource ownership before reassigning a lane; unknown worker state keeps its resources reserved until stopped/settled. Carry earlier passes forward only at an applicable build and boundary, with provenance; otherwise list the missing retest. Never turn an unknown job status into a pass.

At any stop, reconcile worker results, save the next action, retain cleanup debt and run `qa.ts report <qa-root> <run-id>`. A paused or failed run still produces the standard report. If malformed artifacts prevent rendering, preserve them, record the validation error and produce the same report sections manually with readiness unproven; repair only demonstrable data-format mistakes, preserving originals.

Summarize missing execution by capability, cause and next action, with detailed IDs in the report. Not-run cases call for execution; blocked cases call for resolving the named prerequisite. Neither status requires another scenario interview. Ask only when progress depends on a real product decision or changed authorization.
