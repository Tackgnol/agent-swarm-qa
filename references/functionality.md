# Learn functionality: intent first, happy paths derived

The inventory says what the app lets a user do. This phase settles what each **capability** is for, with the user, and derives the happy-path scenarios from that. Optimize questions for decisions resolved. A suite of 140 scenarios may need a handful of capability discussions; its size is not an interview quota.

## Group routes into capabilities

A `task` charter, the agent's alone. Read the inventory and group routes and elements by what a user is trying to accomplish: durable draft editing, party collaboration, external sign-in. A capability may span several routes, and one route may serve several capabilities.

Write one `map.json` path per capability with a title, `routes` (the route IDs it spans) and `disposition: "pending"`. `qa.ts interactions <qa-root>` lists inventoried routes no capability links yet; each one joins a capability or gets an excluded path with a reason. Then chart an `intent` charter and a happy `scenarios` charter per capability, per [wayfinding.md](wayfinding.md).

Allocate paths consecutively (`PATH-001`, `PATH-002`, ...). For later discoveries use `qa.ts next-path-id <qa-root>`. The parent owns allocation. A retired path stays, excluded with its reason; IDs and result history are kept.

## Settle intent

Charter kind `intent`. First draft the brief yourself from what the inventory observed, the source, existing tests and product documentation, marking each line as observed, documented or proposed. For each capability establish:

- **Goal and actors:** what someone must accomplish, and who owns, views or changes the data.
- **Behavior rules:** invariants and meaningful state transitions, including durable and receiving state.
- **Risks and priority:** what could cause real harm, and which outcomes block a release.
- **Open decisions:** only unresolved intent, contradictory requirements or consequential tradeoffs.

Store `intent: { goal, rules, risks }` on the path. Record decisions and their provenance in `interview/decisions.md`. A missing private prerequisite goes through Init's separate handoff.

### Interview only the uncertainty

1. Persist the brief and its open decisions, regenerate the review document (`qa.ts report <qa-root>`), and present it **before** asking anything about it.
2. Focus the preview on `report.html#path-<ID>` and check the heading is visible; use `#case-<ID>` for one specific example. Reuse the tab and restore focus after regenerating. Without viewer control, give the link and an excerpt and say so.
3. Ask the smallest set of questions about product intent, each with a recommendation and its consequence. Follow a dependent branch only when an answer changes it. One capability gets one discussion.
4. Update the brief from the actual answers. Stop when the goal, rules, priority and boundaries distinguish correct from incorrect behavior. Implementation details and test mechanics stay with the agent.

Example discussion, **not preapproved behavior**:

```text
Party collaboration
Goal: the GM can run a party while each member manages their own character.
Proposed rules: character ownership controls editing; the GM roster reflects saved changes;
private fields remain private; leaving a party does not delete a character.
Risks: unauthorized editing, lost saves, stale GM state during play.
One unresolved decision: does membership grant editing of another member's character?
Recommendation: ownership controls editing; explain any intended GM exception.
```

Once that rule is settled, the HP, reload, roster and private-field checks are the agent's to derive. The charter closes when the path holds a goal and at least one rule the user settled, or an excluded disposition with a reason.

## Derive the happy paths

Charter kind `scenarios`, tier `happy`. For each rule, write the journeys in which a legitimate user does the intended thing and it works: create, edit, save and reload, navigate, cancel, and the receiving view where another identity must see the result. Cross-account behavior needs two distinct accounts. Use risk to choose combinations; one scenario per meaningful journey, with the browser, viewport and locale samples agreed in setup.

Failures, denials and abuse wait for the error and adversarial tiers. When one occurs to you now, add a fog line.

Each `scenarios/<QA-ID>.json` holds identities, preconditions, ordered steps, observable expected outcomes, criticality, test boundary, evidence, cleanup, and:

- `tier: "happy"`.
- `operations`: the interaction addresses the steps drive, in order, each one `operated` in the inventory. A step that needs a `skipped` interaction, such as deleting a run-owned draft, is operated first on an owned fixture and its record updated.

Expectations trace to a settled rule or a clearly presented proposal. Mark a scenario critical when it protects an agreed release-blocking outcome. Changing existing criticality needs a recorded decision.

Alongside the scenarios, draft the [swarm execution plan](swarm.md) from what is now known: independent fixture sets, account and session availability, shared browsers or rooms, receiving-view dependencies and request limits. Scheduling inside the confirmed scope needs no further approval.

## Confirm the scope as a batch

Persist the scenarios and regenerate the review document before asking. Lead with the capability's goal and rules, the proposed critical outcomes, a rule-to-scenario coverage table, boundaries, exclusions and remaining questions; link the full scenarios as optional detail. Obtain **one explicit confirmation of the displayed scope**, for one capability or for all of them together. That answer covers exactly the scenarios shown. Keep a genuinely unresolved scenario pending, or exclude it with a reason.

Record the decision and the displayed IDs in `interview/decisions.md`, then:

```text
node <skill>/scripts/qa.ts next-path <qa-root>
node <skill>/scripts/qa.ts approve-batch <qa-root> <actual-scope-decision-reference> PATH-004 PATH-005
node <skill>/scripts/qa.ts check <qa-root>
```

`approve-batch` fingerprints each listed path and its scenarios under that one decision, preflighting the whole batch before writing anything. It records consent; it does not obtain it. A later content change invalidates only the affected fingerprints: present the semantic delta and ask about that. `operations` and `routes` are operating knowledge outside the fingerprint, so repairing an address never needs a new approval.

`next-path` persists the review order in `review.json`; a batch follows that order from the first unfinished path. The order is bookkeeping, and a deliberate jump is recorded with `qa.ts focus-path <qa-root> <path-ID> <actual-user-decision-reference> <reason>`. Individual `approve` commands remain for narrowly revised scenarios.

The charter closes when each of its capabilities has happy-tier scenarios under a current confirmation.
