# Lock in and standardized reporting

## Lock in

Render and inspect the first-run report **before** requesting lock-in. Present the actual scenarios and dispositions, unresolved defects, deferred coverage and evidence limitations. Grill remaining specification questions. Ask the user to confirm that this is the repeatable scenario contract, including any explicitly deferred cases; this is not approval to ignore bugs or deploy.

If that discussion changes a scenario or report, save, regenerate and present the revised document before the next question or lock-in request. Name the reviewed scenario IDs/revision so the answer refers to the visible contract.

After the actual confirmation:

```text
node <skill>/scripts/qa.ts lock <qa-root> <reviewed-run-id> <actual-lock-decision-reference>
```

Locking requires current content approvals, a run snapshot matching the current suite, no open specification questions, and an explicit result/disposition for every scenario. A known failed or blocked scenario can be locked as an agreed expectation; its failure remains visible. `locked.json` stores the suite SHA-256 and source run. Later suite changes invalidate the retest gate and require review/scrutiny before relocking. Approval metadata records a conversation decision; it is not a cryptographic human-authentication system.

## Always the same report

```text
node <skill>/scripts/qa.ts report <qa-root> <run-id>
```

Without a run ID, the helper generates the planning report from current drafts. With a run ID, it uses that run's immutable suite snapshot and observations, not today's edited scenarios. All three outputs derive from one report model:

- `report.json`: machine-readable recommendation, build/scope, counts, every scenario and attempt, evidence, findings and limits.
- `report.md`: standard handoff and issue-triage summary.
- `report.html`: offline visual review with status metrics, scenario/expected/actual cards, attempt history and inline inspected screenshots. No CDN, telemetry or external scripts. Responsive and printable; JSON/MD remain available alongside it.

The standard sections are **Recommendation; Scope & build; Scenario results; Evidence; Findings; Automated suites; Contract fuzzing; Cleanup; Limits & open questions**. Every report includes these concepts even when empty or not run. A failed/interrupted run is not exempt. The generator's recommendation is conservative evidence triage, not an autonomous release approval: disclose any additional project gate not represented by the recorded scenarios.

Critical failures produce a hold. Missing critical coverage, unknown build observation, open questions, unexplained failure/pass pairs or pending cleanup make readiness unproven. Optional missing browser/device checks remain limitations. Known optional defects must stay visible; if project policy makes them blocking, update that criticality with the user's decision. No local/mock pass substitutes for a deployed real-host claim.

Passes with no evidence references or inspected captures are inconclusive. The actual boundary label must match the approved claim; different boundaries remain inconclusive for that scenario. These checks catch mismatches and omissions, not fabricated observations: the reporter summarizes recorded evidence and is not an execution-attestation or credential-audit system. The agent must inspect the evidence and disclose its limits.

## Capture and attachment contract

Use unique names such as `screenshots/general-009-en-1440-privacy.png`; use lane-specific reports/results/traces so workers cannot overwrite them. Each screenshot record has a caption, path relative to the run, and whether the actual image was inspected. A screenshot proves appearance at an instant, not persistence, authorization or stream delivery; correlate those with independent state/HTTP evidence.

The HTML embeds inspected PNG/JPEG/WebP captures within the run, rejecting traversal/private paths and symlink escapes. Limits are 8 MiB per capture and 64 MiB total embedded bytes; missing, oversized, unsafe or uninspected images get explicit notices. Review local originals if omitted; don't silently claim a complete gallery. Keep credentials and private payloads out of shareable captures at collection.

Open the generated HTML with the available file/browser preview and inspect it at desktop and compact width when changing the template. Treat the report as a local artifact until sharing is authorized. A remote issue needs uploaded image attachments embedded as pictures, not local paths or text-only links. Use the configured tracker/mode, deduplicate existing issues and keep local drafts if upload is unavailable. Do not publish artifacts to an unrelated public host as a workaround.

## Final handoff

Lead with the recommendation and blockers, link the report and confirmed issues, summarize coverage without mixing units, and disclose remaining limits/cleanup. Keep raw fuzzer errors/warnings and adjudication separate. Merged fixes can be ready for Verify; close only after applicable deployed checks pass. Preserve historical reports and first failures, and never certify a missing supported-host check from a lower-boundary fixture.
