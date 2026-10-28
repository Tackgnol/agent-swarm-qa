# Mapping and grilling

Map **journeys and states**, not just route strings: a path can include an inline panel, modal, approval tab or receiving view on the same route. Explore current source/navigation and read-only UI within setup boundaries. Reconcile existing tests and known defects, but do not use old QA notes as unquestioned specifications.

Create `map.json` and proposed `scenarios/<ID>.json` using the examples. Keep stable IDs. Each map entry is included with scenario IDs, excluded with rationale, or pending review. Each scenario declares identities, preconditions, ordered steps, observable expectations, criticality, test boundary, evidence and cleanup. Avoid vague “works correctly” assertions and unspecified account context.

Use the aliases/private prerequisite names settled during Init. Path questions establish expected behavior, not credentials, room URLs or login parameters. If a new prerequisite appears, return only that dependency to the dedicated private handoff in Init; keep the current scenario discussion and existing coverage/policy decisions separate.

## Stable numbering and enforced frontier

Assign initial paths consecutive stable IDs (`PATH-001`, `PATH-002`, ...). After IDs have been recorded, use `node <skill>/scripts/qa.ts next-path-id <qa-root>` to allocate new discoveries after the highest assigned number. The parent owns allocation; workers must not choose numbers independently. Keep retired paths as explicitly excluded entries with rationale rather than deleting/renumbering them. Reordering an array or inserting a new discovery must not rename an existing path.

Before **every** question round and on resume, run:

```text
node <skill>/scripts/qa.ts next-path <qa-root>
```

`review.json` persists the numeric order, current path, completed/pending IDs and explicit jumps. Use its current path and listed scenarios for the document, focused card and question; include the path ID and completed/total progress in the context. A path remains current until its reviewed disposition and all included scenarios have current approvals. An exclusion is complete only with approved rationale. Changed earlier content returns to the unfinished frontier. Re-read the cursor after recording answers; do not mentally increment the ID or choose a later section of the document.

The approval helper rejects new out-of-order path/scenario approvals. For a user-approved batch, record each path and its scenario approvals together in cursor order using the same actual batch decision reference; then advance without asking again. A deliberate jump requires both a real user decision and a reason:

```text
node <skill>/scripts/qa.ts focus-path <qa-root> PATH-031 <actual-user-decision-reference> <reason>
```

The override stays on that unfinished path, then returns to the earlier frontier; it never marks bypassed paths complete. Never invent a reason on the user's behalf or skip because prerequisites are missing: preserve that pending path, continue independent non-review work, and ask for a deferral/order decision if needed.

For an existing workspace adopting this guard, reconcile saved decisions first. Record only demonstrable prior user approvals against unchanged content, in order; preserve those answers without re-asking. Unrecorded/ambiguous decisions remain unfinished. If the previous agent jumped ahead, the cursor returns to the first real gap rather than accepting the latest displayed number as progress.

## Interview tree: one path at a time

This adapts the frontier-based grilling approach: every answer settles a decision and unlocks its dependent branches. Always present the current path and its proposed scenarios, even if no ambiguity is obvious. Do not execute the proposed scenario to discover what the expectation ought to be.

1. Read the enforced frontier with `next-path`, then establish discoverable facts for that current path: route, controls, current data shape, available roles/tools and existing tests. Delegate read-only fact gathering when permitted. Ask the human for intent, not codebase facts.
2. Persist the proposed path/scenarios and unresolved decisions **before asking**. Regenerate the current review document; by default use `node <skill>/scripts/qa.ts report <qa-root>` for the planning report. Drafts remain unapproved/not run. Use the user's existing review document if one is already established, keeping it synchronized with the scenario files rather than creating competing copies.
3. Present that updated document: open the available preview and send a clickable absolute link plus a compact path card in chat. Include path/scenario IDs, the current content revision/fingerprint, preconditions, steps, expected outcomes, evidence, cleanup and criticality. Clearly label unresolved choices/proposals. If a panel is queued or cannot open, the chat summary supplies the readable material. Finish this presentation before invoking the question tool.
4. Focus the scenario before asking: reuse the existing report preview, navigate to `report.html#case-<scenario-ID>` or scroll that card into view, and verify its heading is visible after layout settles. Cards expose their ID as a direct link and highlight the current fragment target. Include the same link with the question context. For a batch, focus the first card and link each covered ID; move the preview when the discussion moves to another card. After a regenerated document loads, restore that focus before the next question. If automatic scrolling is unavailable, provide the link plus excerpt and disclose the limitation.
5. Ask the ready frontier of questions about **that displayed version and focused scenario**, with recommendations and a concrete reason for each. Use concise tool questions, normally one to three at a time. Hold questions whose answers depend on an unresolved decision for the next round. Never ask about an unwritten revision or launch questions while the document is still being generated.
6. Challenge the branches that matter: ownership versus membership, private fields, persistence versus optimistic appearance, cancellation, invalid input, live propagation and irreversible/external effects. Choose relevant branches; the human should not answer a generic checklist for every screen.
7. Reflect answers into the scenario and decision log, regenerate and present the updated document, restore the current scenario in view, then ask any dependent questions or final approval of that exact contract. Repeat the document-first sequence after material changes. Then move to the next path. An explicit approval of a displayed batch can settle that batch; do not require a redundant read receipt or reapprove unchanged content.

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

Record actual user answers in `interview/decisions.md`, including which displayed path/scenario revision they address. Update the mapped path's disposition before approving it. If content changes after presentation, show the revised document before asking for approval; an answer about the earlier document does not approve undisclosed changes. The helper records the current content hash:

```text
node <skill>/scripts/qa.ts approve <qa-root> path:PATH-004 <actual-decision-reference>
node <skill>/scripts/qa.ts approve <qa-root> QA-004 <actual-decision-reference>
node <skill>/scripts/qa.ts check <qa-root>
```

Every included path needs scenarios; every scenario must map exactly once. Unknown identities, orphan scenarios, missing decisions and stale hashes block execution. Approvals are per content, not blanket permission for future edits. An excluded path needs an approved reason and no executable scenario IDs.

When new facts invalidate a proposed expectation, return to the affected branch. Preserve earlier decisions and why they changed. Unchanged approvals remain valid. “Observed behavior” never silently overwrites “Expected behavior.” Mapping is complete when all discovered paths have a reviewed disposition and all included scenarios have current approval. Refresh the planning report before handoff.
