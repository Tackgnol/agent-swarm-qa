# Mapping: intent first, tests derived

The interview discovers the essence of a capability. The agent turns that understanding into tests. Optimize questions for decisions resolved, not cases visited. A suite with 140 scenarios may need only a handful of capability discussions; its size is not an interview quota.

## Discover and summarize

Explore current source/navigation, existing tests and read-only UI within setup boundaries. Map journeys and states across routes, panels, dialogs and receiving views. Existing behavior is evidence about implementation, not unquestioned product intent.

Group new paths by coherent user capability, such as durable character editing, party collaboration or external sign-in. A path may cover several screens and many scenarios. Preserve existing fine-grained IDs; discuss related paths together using a capability section in the existing review document instead of renumbering or starting over.

For each capability, establish:

- **Goal and actors:** what someone must accomplish, and who owns, views or changes the data.
- **Behavior rules:** invariants and meaningful state transitions, including durable/receiving state when relevant.
- **Risks and priority:** what could cause meaningful harm; which outcomes block release, and why.
- **Boundaries:** identities, real versus simulated dependencies, permitted effects, evidence and cleanup already agreed during Init.
- **Open decisions:** only unresolved intent, contradictory requirements or consequential tradeoffs.

Store a concise `intent: { goal, rules, risks }` on new map entries. Keep cross-path grouping and actual decisions in the existing review document/`interview/decisions.md`. Reuse saved decisions and product documentation with provenance; flag assumptions as proposals rather than pretending the human confirmed them. Private prerequisites remain aliases/env key names; any new missing prerequisite gets Init's separate private handoff.

## Interview only the uncertainty

1. Persist the capability brief and unresolved choices. Regenerate the current review document (`qa.ts report <qa-root>` by default), then open/link it with a readable summary **before** asking anything about it.
2. Focus the existing preview on `report.html#path-<ID>` and verify the heading is visible. For a cross-path brief, focus its established document section and link its path range. Use `#case-<ID>` only when discussing a particular example. Restore focus after regeneration; if automatic scrolling is unavailable, provide the excerpt/link and disclose that limit.
3. Ask the smallest useful set of questions about product intent, with recommendations and consequences. Follow dependent branches only when an answer changes them. Already-settled rules require no additional question. A coherent capability with several cases gets one discussion, not one round per case.
4. Update the brief from actual answers. Investigate discoverable details yourself. Stop grilling when the goal, rules, priority and boundaries are clear enough to distinguish correct from incorrect behavior; implementation details and test mechanics belong to the agent.

Example discussion, **not preapproved behavior**:

```text
Party collaboration — PATH-004 through PATH-007
Goal: the GM can run a party while each member manages their own character.
Proposed rules: character ownership controls editing; the GM roster reflects saved changes;
private fields remain private; leaving a party does not delete a character.
Risks: unauthorized editing, lost saves, stale GM state during play.
One unresolved decision: does membership grant editing of another member's character?
Recommendation: ownership controls editing; explain any intended GM exception.
```

Do not ask the user to approve separate HP, reload, roster, cancellation and private-field checks after this rule is settled. Derive those checks and show the coverage summary.

## Derive and confirm coverage as a batch

Write concrete `scenarios/<QA-ID>.json` from the rules: the main journey, meaningful failures, relevant permissions, persistence/receiving views, cancellation and boundary cases. Use risk to choose combinations; avoid a separate test for every click or an unrequested matrix cross-product. Mark critical cases by the agreed release-blocking outcomes, rather than making every discovered screen critical. Existing criticality requires an actual rationale/decision to change, never a desire to make the report green.

Alongside the cases, draft the [swarm execution plan](swarm.md) from what Mapping discovered: independent fixture sets, account/session availability, shared browsers/host rooms, receiving-view dependencies and request limits. Group cases into bounded worker assignments and mark which can overlap and which must wait. Refine this plan as facts become available; scheduling within the confirmed scope does not require another human approval round.

Each case still has identities, preconditions, ordered actions, observable expected outcomes, criticality, test boundary, evidence and cleanup. Keep a compact rule-to-case coverage table in the review document. Trace expectations to settled intent or a clearly presented proposal, never to a passing observed result. A new expected rule outside the settled intent returns only that decision to the user.

Persist the generated cases and regenerate/present the review document before confirmation. Lead with capability goals/rules, proposed critical outcomes, coverage counts, boundaries, exclusions and remaining questions. Link the full cases as optional detail. Obtain **one explicit confirmation of the displayed scope**, for a capability batch or the whole mapped suite. The confirmation covers its exact generated specs; the human need not inspect or answer each case. Do not ask a second set of case approvals after that answer. Keep genuinely unresolved cases pending or explicitly exclude/defer them with rationale.

Record the actual scope decision and displayed revision/IDs in `interview/decisions.md`, then:

```text
node <skill>/scripts/qa.ts next-path <qa-root>
node <skill>/scripts/qa.ts approve-batch <qa-root> <actual-scope-decision-reference> PATH-004 PATH-005 PATH-006 PATH-007
node <skill>/scripts/qa.ts check <qa-root>
```

`approve-batch` fingerprints each listed path and all its current cases under that one decision. It preflights the batch before writing approvals and preserves unchanged prior approval references. It records consent; it does not obtain it. Exact case/path content changes still invalidate the relevant hashes: present the semantic delta and revised batch for confirmation, without re-interviewing unchanged rules. Future undisclosed cases are not covered by an earlier confirmation.

## Stable IDs and resume

Allocate initial paths consecutively (`PATH-001`, `PATH-002`, ...). For discoveries, use `qa.ts next-path-id <qa-root>` after the highest assigned number. The parent owns allocation. Retired paths remain explicitly excluded with rationale; keep existing IDs and result history.

`next-path` persists numeric order and unfinished/completed IDs in `review.json`. Before recording a batch, read this cursor; include the consecutive unfinished frontier in that order. Related paths can share a discussion, and an entire displayed suite can share one confirmation. The cursor never requires a separate human question for every path or scenario. A deliberate jump requires an actual user decision and reason:

```text
node <skill>/scripts/qa.ts focus-path <qa-root> PATH-031 <actual-user-decision-reference> <reason>
```

That override returns to the earlier frontier after completion. Missing prerequisites preserve pending work rather than silently skipping it. Existing individual `approve` commands remain available for narrowly revised specs and older workspaces.

On migration/resume, reconcile demonstrable prior approvals against unchanged content first. Summarize remaining work by capability, reuse established intent and ask only unresolved decisions plus any needed displayed batch confirmation. Preserve incomplete execution as incomplete execution: a list of not-run or blocked cases is not a new interview backlog. Mapping is complete when included specs have current scope confirmation and exclusions have approved rationale. Missing accounts/host access may block execution without invalidating settled intent.
