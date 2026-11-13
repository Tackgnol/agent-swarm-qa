# Trial: scvmrack on production, 2026-11-13

The first run of the skill against a real app: [scvmrack](https://scvmrack.rpgtools.co), a MORK BORG character sheet, tested live on production by a parent agent orchestrating Sonnet workers. The aim was to see how the skill performs, not to certify the app.

## What ran

| Phase | Outcome |
|---|---|
| Setup | Closed. Destination: a locked happy-path baseline, guest only for now. Error and adversarial tiers ruled out on production. |
| Account | Blocked: sign-up at the app's Logto is behind reCAPTCHA Enterprise. A barrier note was written; nothing was bypassed. |
| Find routes | 24 routes from source and a guest crawl. |
| Inventory | 10 guest-reachable routes, 212 interactions (196 operated, 16 skipped), 5 workers. 12 routes wait on an account or an Owlbear room. |
| Capabilities and intent | 11 capabilities. Four intent questions put to the user; all rules settled. |
| Scenarios | 24 happy-path scenarios from 3 workers, confirmed by the user in one batch. |
| Happy run | Paused: 12 passed, 1 failed, 2 inconclusive, 9 not run. One lane stopped on a safety refusal to create more data, one on a 502. |

## What held

- **Focus.** Across a long, twice-restarted session the map stayed the source of what came next. Every phase resumed from `qa.ts map`.
- **Close checks.** Charters closed only against recorded state; refusals listed what was missing, and workers did that work instead of rewording.
- **Barriers and refusals.** Workers stopped at the CAPTCHA and at the safety refusal and reported, instead of working around them.
- **Interview load.** The user answered four small question rounds: setup, intent, scope, and the run's follow-ups. Nothing was asked per route or per element.

## What broke

- **Writes.** Learning and running the app created about 30 undeletable guest characters on production, over the agreed budget. Exploration by trial against the live app was the main cause.
- **Shared files.** Parallel workers edited the same JSON files with nothing to serialize them.
- **Operating knowledge versus scenarios.** Elements whose click creates data could not be referenced by the scenarios that needed them.
- **Harness.** Each worker rebuilt the same Playwright plumbing; the parent's ad-hoc harness had a bug that lost a fixture ID.

## Gaps and their status

50 fixed, 4 partly fixed, 2 open. Numbers follow the order the gaps were found in.

| # | Gap | Status | Where | Fix |
|---|---|---|---|---|
| 1 | `.env.qa` assumes a local machine | fixed | Docs | init.md: cloud-session options for credentials |
| 2 | Workspace location | open |  | init.md still describes only the product-root workspace |
| 3 | Who writes routes.json and charters inventories | fixed | Helper | shared files change through locked helper commands |
| 4 | No write protection on charters.json | fixed | Helper | one lock around every map change |
| 5 | Route finding has no way to be pure read-only | fixed | Docs | interactions.md: "A page load can write" |
| 6 | Reconciling source and crawl is under-specified for aliases, redirects and 404 patterns | fixed | Docs | interactions.md: what counts as one route; excluded covers non-pages |
| 7 | Source-only routes needing credentials | fixed | Docs | blocked inventories name the access charter they wait on |
| 8 | Examples/commands assume CommonJS-friendly scratch scripts | fixed | Harness | harness and example runner are .cjs; init.md asks for session facts |
| 9 | Close with a relative qa-root worked once and then I re-ran with the absolute path, which printed 'already closed' | fixed | Helper | close prints what it checked; gist corrects a closed gist |
| 10 | Plain Node `fetch` ignores the session proxy | fixed | Harness | apiGet reads through the page; init.md asks about proxy quirks |
| 11 | Barriers.md tells a worker to rule out ordinary causes, but a sandbox network block that hides a captcha script is both | fixed | Docs | barriers.md: a blocked bot-check script is still a barrier |
| 12 | No guidance for private runner state | partial | Docs | execution.md: storage state under the lane private/ folder; no wider convention |
| 13 | No fixture ledger outside a run | fixed | Helper | writes.json holds fixtures for every phase |
| 14 | Shared layout is not addressed | fixed | Docs | shared layout inventoried once |
| 15 | Fixed mid-run | fixed | Helper | mid-run fixes |
| 16 | Route notes versus charter bounds | fixed | Docs | route reason holds standing facts; phase rules go in missions |
| 17 | Identities that are not available yet | fixed | Helper | pendingIdentities on a route, shown in the summary |
| 18 | Page-level actions and post-submit states | fixed | Helper | navigate, reload and back as page-level actions |
| 19 | No starter for a persistent browser context | partial | Harness | session() accepts storageState; no app-specific starter |
| 20 | One record per element and action is silent on repeats | fixed | Docs | rules for repeated items and multiple triggers |
| 21 | A modal hides the page from the accessibility snapshot | fixed | Docs | re-snapshot after dismissing a modal |
| 22 | The close message points at "graduate" without saying how | fixed | Helper | close tells the parent to chart-add, with the file shape |
| 23 | Session facts lived only in the parent's brief | fixed | Docs | session facts go in the map notes |
| 24 | "Rename with a QA prefix" assumed the app allows it | fixed | Docs | mark test data where the app allows; the fixture ID is the marker otherwise |
| 25 | Redirect-only routes and non-element actions need a named convention | fixed | Helper | fixed list of actions, validated |
| 26 | Destructive controls that also create data | fixed | Docs | destructive controls in their own step; delete is not cleanup |
| 27 | Close message is noise for workers | fixed | Helper | close message differs for workers and the parent |
| 28 | One all-or-nothing grouping charter stalls the effort | fixed | Docs | group what is inventoried; the rest is fog |
| 29 | Run and lock charters are under-specified in functionality.md | fixed | Docs | charting table gives run and lock charters and the run ID |
| 30 | chart-add fog matching is exact-string and undocumented | fixed | Helper | fog lines removed by unique opening words |
| 31 | Grouping judgement calls are not mentioned | fixed | Docs | grouping judgement calls written down |
| 32 | Interaction files are large and flat | fixed | Helper | interactions <qa-root> <route> prints a route by section |
| 33 | Map "Next" prefers charted order over what the parent can delegate | fixed | Helper | map splits the frontier into user and agent work |
| 34 | No way to lint draft scenarios before approval | fixed | Helper | lint-scenarios |
| 35 | Scenario derivation in parallel has shared-file problems again | fixed | Helper | wire-scenarios; parent hands out ID ranges |
| 36 | `skipped` blocks legitimate scenario entry points | fixed | Helper | deferred interaction state; scenarios may reference it |
| 37 | No helper lists interaction addresses | fixed | Helper | interactions <qa-root> <route> |
| 38 | Scenario count guidance is vague | fixed | Docs | how many scenarios: rules first, variants only when a rule needs them |
| 39 | No field for "needs operating" | partial | Helper | deferred plus a lint warning; no needs field |
| 40 | Inventory missed nested dialog controls | partial | Docs | documented; not enforced by the inventory close check |
| 41 | Not every scenario needs a fixture | fixed | Docs | preconditions written per scenario |
| 42 | The address format is not self-evident from the file | fixed | Docs | address format spelled out |
| 43 | Fresh fixture per scenario forces repeated setup | fixed | Docs | shared fixtures allowed when no scenario changes what another reads |
| 44 | Harness bug (parent's) | fixed | Harness | harness ships with the skill, with tests |
| 45 | Probing is unbudgeted | fixed | Docs | build runners read-only first; one fixture for exploration |
| 46 | Permission layer versus agreed effects | fixed | Docs | a refusal stops the lane; the parent reports it, never repeats it |
| 47 | Sections without stable handles | open |  | regions without stable handles still need heuristics |
| 48 | Helper bug: `run` and `lock` overwrite checkpoint.json | fixed | Helper | run and lock merge into the checkpoint |
| 49 | Resolution semantics are incomplete | fixed | Helper | check-corrected resolution |
| 50 | No way to amend a check-only error when replay is unsafe | fixed | Docs | appended correction record instead of an in-place edit |
| 51 | Harness gaps (to fold into a shipped harness) | fixed | Harness | attempt-numbered screenshots, writes(), trouble(), dialog() |
| 52 | Scenario expectations drifted beyond the rules | fixed | Helper | lint warns on rules that match no settled rule |
| 53 | "Stop on 5xx" is ambiguous | fixed | Docs | execution.md: when a 5xx stops a scenario, a lane, every lane |
| 54 | Random fixtures make scenarios non-deterministic | fixed | Docs | scenarios build the state they need |
| 55 | Exploration blew the agreed write budget | fixed | Helper | write budget enforced by spend |
| 56 | Attempts mix runner crashes with observations | fixed | Harness | runnerError logs crashes apart from attempts |

## Not yet tried

- The fixed skill on a second app, or this one on a local stack, where writes cost nothing.
- Signed-in identities, multi-account journeys and the Owlbear extension.
- Locking a baseline, a retest on a new build, and the error and adversarial tiers.
