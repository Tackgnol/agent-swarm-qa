# Wayfinding: the map, charters and fog

The map is how the effort keeps its focus across long conversations, compactions and fresh sessions. Everything needed to know where the effort stands is on disk, so `qa.ts map <qa-root>` returns the same answer whether the conversation remembers anything or not.

## The map is an index

`charters.json` is the store: the destination, standing notes, the charters, the fog and what is out of scope. `qa.ts map` renders it at low resolution and writes the same text to `map.md` for the user. Edit `charters.json`; `map.md` is regenerated.

A charter keeps one line of outcome, its **gist**. The detail lives in exactly one place, the artifact the charter produced: `routes.json`, `interactions/<route>.json`, an intent in `map.json`, `scenarios/`, a run directory, `interview/decisions.md`. Zoom into those files when a charter needs them.

`checkpoint.json` holds position inside the charter in hand: active jobs, pending questions, the next concrete step. The map says which charter; the checkpoint says where in it. Update the checkpoint before waiting on the user.

## Charter shape

```json
{
  "id": "inventory-draft-editor",
  "name": "Inventory the draft editor",
  "kind": "inventory",
  "mode": "AFK",
  "mission": "Find and operate every interactive element on /drafts/:id as owner.",
  "subjects": ["draft-editor"],
  "blockedBy": ["find-routes"],
  "status": "open",
  "claimedBy": null,
  "gist": ""
}
```

- **`name`** is how the user reads it: a short title that says what gets done. **`id`** is a short slug for commands.
- **`mission`** is specific enough that a fresh session could start from it alone.
- **`subjects`** says what the charter is about and drives its completion check: a route ID for `inventory`, capability path IDs for `intent` and `scenarios`, a run ID for `run` (choose it when charting; the run is then created under that ID). Several related paths can share one `intent` or `scenarios` charter when they will be discussed together.
- **`tier`** is set on `scenarios` charters: `happy`, `error` or `adversarial`.
- **`blockedBy`** lists the charters that must close first.
- **`status`** changes only through `close` and `rule-out`; **`claimedBy`** only through `claim` and `release`.

Size a charter to fit comfortably in one session: one route, one capability, one run, one lock. A charter that keeps growing is several charters.

`examples/charters.json` shows a map partway through the interaction phase.

## Frontier and claims

The **frontier** is every charter that is open, unclaimed and unblocked. The map lists it in charted order, and the default next charter is the first one.

`claim` records who holds a charter. A claimant holds one charter at a time: the parent claims as `parent`, each swarm worker under its lane ID (`qa.ts claim <qa-root> <charter> lane-3`). A worker closes its own charter; the parent verifies the artifacts before depending on them. Only the parent edits `charters.json` to add charters or fog.

When the charter in hand turns out to need something first, chart the blocker, add it to `blockedBy`, `release` the charter and take the blocker.

## Fog and out of scope

The map is deliberately incomplete. **Fog** is work toward the destination that cannot yet be stated as a mission, because it hangs on charters still open. The test is whether you can write the mission precisely now, whatever its blockers. A precise mission is a charter, even when blocked. Anything vaguer is one fog line, as loose as the view allows.

**Out of scope** is work beyond the destination, however clear. It never graduates. Rule out an existing charter with `qa.ts rule-out <qa-root> <charter> "<reason>"`; record work that never became a charter as a line in `outOfScope`. Scope questions belong to the user: the agent proposes, the user rules.

## What each close graduates

After a close, chart what has become specifiable and delete the fog lines it replaces.

| Closed | Chart next |
|---|---|
| Find every route | Already done as part of closing it: one `inventory` charter per pending route, each blocked by route finding. Add a `task` charter, blocked by all the inventories, to group routes into capabilities. |
| The last inventory, then the grouping task | Per capability: an `intent` charter, and a happy `scenarios` charter blocked by it. Then one `run` charter blocked by all happy `scenarios` charters, and a `lock` charter blocked by the run. |
| A run that met an ambiguous expectation | An `intent` charter for that one question, blocking the lock. |
| Lock the baseline | Per capability: an error `scenarios` charter. Then a `run` and a `lock` for the error tier. |
| Lock the error tier | Per capability: an adversarial `scenarios` charter. Then a `run` and a `lock`. |
| Any charter that hit a barrier the user could lift | A HITL `task` charter stating the exact thing to provision, per [barriers.md](barriers.md). |

When the user's destination stops earlier, for example at the baseline, move the later layers from fog to out of scope.

A retest of a locked suite on a new build is one `run` charter. A changed expectation is an `intent` charter, then the affected `scenarios`, `run` and `lock` charters.

## Adopting an existing workspace

A workspace created before the map has no `charters.json`. Run `qa.ts chart <qa-root>` to chart the opening, then bring the map level with reality:

1. Name the destination from `interview/decisions.md` and the existing lock, and confirm it with the user.
2. Close each charter the recorded state already satisfies; the close checks keep this honest.
3. Chart the remaining work from the table above. Existing scenarios without a `tier` count as the happy baseline.
4. Where the workspace has no route inventory, chart route finding and the inventories as normal: operating knowledge for an already-locked suite is still worth having.

## Commands

```text
node <skill>/scripts/qa.ts map <qa-root> [all]                 low-resolution map; `all` lifts the per-section cap
node <skill>/scripts/qa.ts claim <qa-root> <charter> [claimant]  take a charter; prints mission, reference and criterion
node <skill>/scripts/qa.ts close <qa-root> <charter> "<gist>"    close against the criterion
node <skill>/scripts/qa.ts release <qa-root> <charter>           hand a charter back to the frontier
node <skill>/scripts/qa.ts rule-out <qa-root> <charter> "<reason>"
node <skill>/scripts/qa.ts chart <qa-root>                       chart the opening for a workspace without a map
```

Every command validates `charters.json` and names the first problem it finds: an unknown blocker, a blocking cycle, a closed charter without a gist.
