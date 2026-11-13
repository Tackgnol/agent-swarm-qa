# Plan and dispatch the QA swarm

Use when route inventories, a run's lanes or adversarial lanes can proceed side by side. Draft assignments while deriving scenarios and finalize them before a run. The parent translates charters and approved intent into bounded tasks, schedules shared resources, and reconciles the evidence. Prefer useful parallel work when subagents are available; do not manufacture extra lanes to fill slots.

## Workers and charters

A worker holds one charter at a time, claimed under its lane ID (`qa.ts claim <qa-root> <charter> lane-3`), and closes it itself; the close check is its exit gate. A worker may carry a short queue of charters that share its resources (inventories using one guest fixture), taking them one after another. A `run` charter belongs to the parent, which splits its scenarios into lanes as below. The parent keeps its own charter in hand, usually the HITL one the user is answering, and charters what each close makes specifiable. Workers park what they notice as fog through `qa.ts chart-add`.

**Write the shared brief once.** Put what every worker of a phase needs (paths, the harness, session facts, bounds, how to park, what to report) in one brief file under the QA root, and give each worker only its own assignment on top. Facts about the session itself (script format, proxy quirks, a first-visit dialog) go in the map's notes, which every worker reads first.

**Workers report skill friction.** Each report ends with numbered points where the skill's documents or helpers were unclear, wrong or in the way. The parent files them; workers do not edit shared files to do it.

## Build the plan from learned work

Save a draft `execution-plan.md` in the QA root while deriving scenarios. For an actual run, save its finalized plan and scheduling updates under `runs/<run-id>/execution-plan.md`; historical plans stay with their runs. This is a parent-owned scheduling ledger, not an automatic mutex. Record:

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
| Shared files | `charters.json`, `routes.json`, `map.json` and `writes.json` change only through helper commands, which serialize under one lock. Approvals, aggregate results and final reports are the parent's. Workers write their lane artifacts and, for an inventory, their own `interactions/<route>.json`. |
| Request limits | Divide a target-wide request budget across workers, including shared egress/IP limits. Browser isolation does not create a fresh service budget. |
| Write budget | Divide the remaining agreed writes (`qa.ts budget`) between lanes and state each lane's share in its brief, keeping a margin. Every lane spends through `qa.ts spend`, which refuses once the whole budget is gone. |

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
Read: <run suite snapshot, relevant approved scenario/intent entries, and the
      interactions/<route>.json files their operations point into>.
Resources: <allocated account aliases, verified context handles, fixture namespace,
            host alias, ownership/access constraints>. Private values stay in .env.qa;
trusted runners load them. Never inspect or print them.
Start only after: <prerequisite completion + verified handoff evidence, or none>.
Permitted actions: <approved effects>. Preserve <existing/shared data>.
Request budget: <lane share of the target budget>. Write budget: <lane share>, spent
through qa.spend before each write; build runners read-only first.
Evidence: runners built on <skill>/scripts/harness.cjs; attempts appended with
qa.record, runner crashes with qa.runnerError, fixtures with qa.fixture.
Stop/report: 429, a second 5xx, unintended changes, a permission or safety refusal,
a resource conflict, unexpected build/identity, or an unresolved specification decision.
Cleanup: <owned fixtures that may be removed now versus those to hand off>.
Return: dispositions for assigned cases, artifacts, limitations, fixtures, inventory
corrections, candidate findings, skill friction and next action.
Keep expectations unchanged. Route questions through the parent. Do not edit product
code, shared QA files or external issues, or delegate further without assignment.
```

Give the worker the relevant sanitized artifacts rather than making it rediscover the whole app. Before real actions, it verifies assigned target, identity and resource isolation; a mismatch is a block to report, not permission to borrow another lane's session. Missing credentials are reported by alias/key name only.

## Schedule, reconcile and resume

Reserve resources in the plan before starting a worker. Launch dependency-ready lanes within available slots, retaining parent capacity to coordinate. If the environment limits active workers or no useful independence exists, queue the remainder and disclose serial coverage. Monitor progress and unblock queued work when its dependencies and resources are ready.

A worker's completion message does not release shared fixtures automatically. Verify its artifacts and prerequisite evidence; only then hand fixtures to dependents or clean them after their last consumer. On 429 or service instability, suspend every lane sharing the affected target/budget and reconcile in-flight work before another attempt. Interrupted or unknown worker state keeps resources reserved until the parent confirms the worker stopped and its in-flight effects settled.

A worker that stops on a refusal from the session's permission or safety layer has done the right thing. The parent reports the refusal to the user and does not repeat the refused action itself or through another worker.

Before merging lane results, check the case/matrix assignment, target/build/suite provenance, actual test boundary, attempt numbering, safe run-relative evidence paths and fixture ownership. Preserve failures and distinguish product defects from harness/resource conflicts. Deduplicate candidate findings while retaining their evidence. Missing or unsupported worker claims stay blocked/not-run/inconclusive; a summary is not proof of execution. The parent alone updates aggregate results and the standard report.

On resume, read this saved plan with the checkpoint and live agent/job state. Continue unfinished assignments; reassign only after ownership is reconciled. Preserve completed evidence and all earlier attempts. No worker may change expected behavior or mark another lane's scope complete to resolve a scheduling problem.
