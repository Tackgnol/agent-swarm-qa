# Mapping and grilling

Map **journeys and states**, not just route strings: a path can include an inline panel, modal, approval tab or receiving view on the same route. Explore current source/navigation and read-only UI within setup boundaries. Reconcile existing tests and known defects, but do not use old QA notes as unquestioned specifications.

Create `map.json` and proposed `scenarios/<ID>.json` using the examples. Keep stable IDs. Each map entry is included with scenario IDs, excluded with rationale, or pending review. Each scenario declares identities, preconditions, ordered steps, observable expectations, criticality, test boundary, evidence and cleanup. Avoid vague “works correctly” assertions and unspecified account context.

## Interview tree: one path at a time

This adapts the frontier-based grilling approach: every answer settles a decision and unlocks its dependent branches. Always present the current path and its proposed scenarios, even if no ambiguity is obvious. Do not execute the proposed scenario to discover what the expectation ought to be.

1. Establish discoverable facts yourself: route, controls, current data shape, available roles/tools and existing tests. Delegate read-only fact gathering when permitted. Ask the human for intent, not codebase facts.
2. Present a compact path card: purpose/identities → proposed preconditions and steps → exact expected outcomes → evidence and cleanup → critical versus optional.
3. Ask the ready frontier of questions for this path, with recommendations and a concrete reason for each. Use concise tool questions, normally one to three at a time. Hold questions whose answers depend on an unresolved decision for the next round.
4. Challenge the branches that matter: ownership versus membership, private fields, persistence versus optimistic appearance, cancellation, invalid input, live propagation and irreversible/external effects. Choose relevant branches; the human should not answer a generic checklist for every screen.
5. Reflect answers into the scenario and decision log, show material changes, and obtain approval of this exact contract. Then move to the next path. An explicit approval of a displayed batch can settle that batch.

Example path card, **not preapproved behavior**:

```text
PATH-004 · member edits a shared character
Identities: member owns the character; GM views the party roster.
Steps: change HP, wait for save, reload member sheet, inspect GM roster without reloading it.
Expected: durable HP equals the saved value; GM sees the change through the supported live-update mechanism.
Evidence: sanitized save/read correlation plus settled screenshots of both views.
Cleanup: delete only this run's fixtures after all party checks finish.
Ready decisions: Does party membership grant editing or only read access? Is live propagation release-critical?
Recommendation: ownership controls editing; roster consistency is critical if the GM uses it during play.
Dependent question, after authority is settled: Which fields must remain private in the member view?
```

## Record approvals and revisions

Record actual user answers in `interview/decisions.md`. Update the mapped path's disposition before approving it. The helper records the current content hash:

```text
node <skill>/scripts/qa.ts approve <qa-root> path:PATH-004 <actual-decision-reference>
node <skill>/scripts/qa.ts approve <qa-root> QA-004 <actual-decision-reference>
node <skill>/scripts/qa.ts check <qa-root>
```

Every included path needs scenarios; every scenario must map exactly once. Unknown identities, orphan scenarios, missing decisions and stale hashes block execution. Approvals are per content, not blanket permission for future edits. An excluded path needs an approved reason and no executable scenario IDs.

When new facts invalidate a proposed expectation, return to the affected branch. Preserve earlier decisions and why they changed. Unchanged approvals remain valid. “Observed behavior” never silently overwrites “Expected behavior.” Mapping is complete when all discovered paths have a reviewed disposition and all included scenarios have current approval. Refresh the planning report before handoff.
