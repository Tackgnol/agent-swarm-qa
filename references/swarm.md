# Plan and dispatch the QA swarm

Use during Mapping to draft assignments and before First run/Retest to dispatch them. The parent translates approved feature intent into bounded tasks, schedules shared resources, and reconciles the evidence. Prefer useful parallel work when subagents are available; do not manufacture extra lanes to fill slots.

## Build the plan from mapped work

Save a draft `execution-plan.md` in the QA root during Mapping. For an actual run, save its finalized plan and scheduling updates under `runs/<run-id>/execution-plan.md`; historical plans stay with their runs. This is a parent-owned scheduling ledger, not an automatic mutex. Record:

- Target environment reference, observed build and suite fingerprint.
- Each lane's case IDs and assigned browser/viewport/locale/boundary combinations, objective and worker identity/status.
- Account aliases, browser/session/profile allocations, fixtures/host-room aliases, resource ownership and access needs.
- Prerequisite lanes or fixture handoffs, readiness evidence, request budget, artifact directory and cleanup owner.
- Current running/waiting/completed/blocked assignments and the reason each waiting lane cannot start.

Assign each agreed case/matrix combination to one primary worker; preserve intentional confirmation attempts as separate attempts. Account for all agreed scope, including work held for prerequisites. Reuse existing passed evidence only at an applicable build and boundary. Derive matrix assignments from the agreed sampling, not an invented cross-product.

## Establish independence before overlap

Two lanes can overlap only when their actions cannot invalidate each other's preconditions, observations or evidence. Check actual tool/resource behavior:

| Resource | Scheduling rule |
|---|---|
| Browser/profile/session | Verify separate isolated contexts and tool targeting. Different tabs or tool handles may share cookies or the same controlled page. One operator controls a shared surface. |
| Account | Keep login/logout, account-wide settings and mutable account collections exclusive. Separate browser contexts do not isolate server-side account state. Share read access only while its observed state stays stable. |
| Fixtures | Give each lane its own namespace/IDs. Sequence overlapping reads and writes; a read-only observer can still be disrupted by another lane's mutation. |
| Shared room, scene or external host | One lane operates it at a time, including scene switches and cleanup. Keep a multi-account journey under one operator with allocated actor contexts. Separate rooms may still share account or service limits. |
| Parent files | Only the parent writes mapping, approvals, aggregate results, fixture ledger and final reports. Workers write only their assigned lane artifacts. |
| Request limits | Divide a target-wide request budget across workers, including shared egress/IP limits. Browser isolation does not create a fresh service budget. |

For example, guest browsing with isolated browser storage, owner draft editing on account A with its own fixtures, and read-only contract checks may overlap if their rate budget and state dependencies permit. A party journey needing A and B waits for A's editing lane to finish. A shared-room integration lane gets an exclusive room/browser turn. Splitting these by feature name alone would conceal the conflicts.

If only one shared browser is controllable, serialize its operators. Other agents can gather source facts or analyze already-collected evidence within scope; they cannot claim a live journey passed from that analysis. Missing isolation can reduce parallelism without expanding credentials or fixture permissions. Ask only if progress requires a genuinely new prerequisite or authorization.

A numeric request allocation is planning, not rate-control enforcement. Include browser startup and background polling in the applicable service budget, leaving headroom for the parent and other traffic. Use available request observation and existing runner throttles to verify the budget; if traffic cannot be coordinated reliably, reduce network concurrency or pause that work and report the limitation. Do not bypass the app's limiter to make the plan fit.

## Give each worker a complete assignment

Use a prompt with the following information, adapted to the actual lane:

```text
Lane: <lane-id>, output: runs/<run-id>/lanes/<lane-id>/
Goal: <bounded capability or test objective>.
Target: <environment alias/approved public URL>, observed build <identity>.
Suite: <fingerprint>; assigned cases <IDs> at <matrix combinations/boundaries>.
Read: <run suite snapshot and relevant approved scenario/intent entries>.
Resources: <allocated account aliases, verified context handles, fixture namespace,
            host alias, ownership/access constraints>. Private values stay in .env.qa;
trusted runners load them. Never inspect or print them.
Start only after: <prerequisite completion + verified handoff evidence, or none>.
Permitted actions: <approved effects>. Preserve <existing/shared data>.
Request budget: <lane share of the target budget>.
Evidence: append lane results using the Result shape from scripts/models.ts;
record actual boundaries, inspected captures, findings and fixture IDs/cleanup debt.
Use lane-specific screenshot filenames and paths relative to the run.
Stop/report: 429, unstable service, unintended changes, resource conflict,
unexpected build/identity, or an unresolved specification decision.
Cleanup: <owned fixtures that may be removed now versus those to hand off>.
Return: dispositions for assigned cases, artifacts, limitations, fixtures and next action.
Keep expectations unchanged. Route questions through the parent. Do not edit product
code, shared QA files or external issues, or delegate further without assignment.
```

Give the worker the relevant sanitized artifacts rather than making it rediscover the whole app. Before real actions, it verifies assigned target, identity and resource isolation; a mismatch is a block to report, not permission to borrow another lane's session. Missing credentials are reported by alias/key name only.

## Schedule, reconcile and resume

Reserve resources in the plan before starting a worker. Launch dependency-ready lanes within available slots, retaining parent capacity to coordinate. If the environment limits active workers or no useful independence exists, queue the remainder and disclose serial coverage. Monitor progress and unblock queued work when its dependencies and resources are ready.

A worker's completion message does not release shared fixtures automatically. Verify its artifacts and prerequisite evidence; only then hand fixtures to dependents or clean them after their last consumer. On 429 or service instability, suspend every lane sharing the affected target/budget and reconcile in-flight work before another attempt. Interrupted or unknown worker state keeps resources reserved until the parent confirms the worker stopped and its in-flight effects settled.

Before merging lane results, check the case/matrix assignment, target/build/suite provenance, actual test boundary, attempt numbering, safe run-relative evidence paths and fixture ownership. Preserve failures and distinguish product defects from harness/resource conflicts. Deduplicate candidate findings while retaining their evidence. Missing or unsupported worker claims stay blocked/not-run/inconclusive; a summary is not proof of execution. The parent alone updates aggregate results and the standard report.

On resume, read this saved plan with the checkpoint and live agent/job state. Continue unfinished assignments; reassign only after ownership is reconciled. Preserve completed evidence and all earlier attempts. No worker may change expected behavior or mark another lane's scope complete to resolve a scheduling problem.
