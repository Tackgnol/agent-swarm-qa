# Learn interactions: routes, elements, operation

This phase produces the **inventory**: every route, every interactive element on it, and how to operate each with Playwright. It is the agent's own work. The user is asked nothing here except to lift a barrier.

The inventory is operating knowledge. It says how to drive the app and what was seen to happen; whether that behavior is correct is settled later, in [functionality.md](functionality.md).

## Driver

Playwright is the driver and its locators are the stored format, so the same record serves a Playwright MCP session, a product's own `@playwright/test` suite and a saved runner. Discover which Playwright is available (browser tools exposed to the agent, the product's install, the environment's install) and record the choice in the map's notes. Log in through a trusted runner or a manually authenticated session per [init.md](init.md), one isolated browser context per identity.

Scripts build on the shipped harness, `<skill>/scripts/harness.cjs`: a tracked browser session, a request log that separates API calls, writes and third-party hosts, attempt-numbered screenshots, budgeted writes and fixture records. `examples/runner.cjs` shows its use. Put what is specific to the app (signing in, dismissing a first-visit notice) in `<qa-root>/runners/lib/` once, so every later script reuses it.

Prefer locators in this order, taking the first that identifies the element uniquely inside its section:

1. `getByRole(role, { name })`
2. `getByLabel`, `getByPlaceholder`, `getByText`, `getByAltText`, `getByTitle`
3. `getByTestId`
4. `locator(css)` as the last resort, with the reason in the effect text

A locator names the element by what every user sees. Where an element is identified by fixture or account data, such as the row for one particular draft, store the structural locator (`getByRole('row')`) and leave the choice of row to the scenario's preconditions. Where the visible text varies per fixture (a placeholder, a generated name), use a test id. A dialog without an accessible name is found by its text: `getByRole('dialog').filter({ hasText: '...' })`. Private values never enter a locator or an effect.

## A page load can write

Reading is not always read-only. Opening a URL may create a session, a record or a token. In every script, watch the request log for non-GET requests (`log.writes()` in the harness) and treat a write you did not intend as a finding about the route:

- Record it in the route's `reason` ("a first visit creates a guest character: POST /api/characters/new 201") and do not revisit the route casually.
- Count it against the write budget and record the fixture it left (see [execution.md](execution.md), "Writes are budgeted").

## Find every route

Charter kind `routes`. Build `routes.json` from every source and reconcile them:

- **Source:** the router configuration or file-based route tree, redirects, guards, and links built in code. Record each parameterized route once as a pattern.
- **Crawl:** starting from the entry URL, follow navigation, menus, footers and in-page links once per identity, since navigation differs by role. Include states that carry their own URL: tabs, steps, dialogs and filters driven by path or query.
- **Sitemap, robots and documentation**, when present.
- **The user's own list**, when they offered one.

```json
{ "id": "draft-editor", "pattern": "/drafts/:id", "title": "Draft editor",
  "sources": ["source", "crawl"], "identities": ["owner"], "status": "pending", "reason": "" }
```

`id` is a short slug that reads well inside an address. `identities` lists the aliases that reach the route. `reason` holds standing facts about the route that every later reader needs; an instruction that applies to one phase only belongs in that charter's mission. `status` starts `pending` and ends as one of:

- `inventoried`: its elements are recorded in `interactions/<id>.json`.
- `unreachable`: found in one source and never reached; the reason says what was tried, for example a missing role or a feature flag.
- `excluded`: left out on purpose. Either the user ruled it out (the reason cites the decision), or it is not a page with elements to operate, such as a sitemap file or a URL rewrite (the reason says what it is).

What counts as one route:

- **Redirects and aliases** that end on another route (`/character` landing on `/character/:id`) are routes of their own: what they do on the way is behavior. Their inventory is usually a single `navigate` interaction.
- **Query-driven views** that render a different screen (`/panel.html?view=card`) are separate routes. A query that only filters or pre-selects is a state of its route.
- **The catch-all** not-found page is one route with pattern `*`.
- **A second entry point** (an extension panel, an embed) is listed with its own routes.

A route found in source and missed by the crawl is the interesting case: find how a user gets there before calling it unreachable. A route the crawl found and the source lacks goes in as well.

**Identities that are not available yet.** A route that needs an account or a host room the session does not have stays `pending`, recorded from source with the identities that would reach it. A route reachable now by some identities and later by others is inventoried for those available, with the rest listed in `pendingIdentities`; chart a second inventory charter for them, blocked by the charter that will provide the identity.

Before closing, chart one `inventory` charter per pending route (see [wayfinding.md](wayfinding.md)), blocked by route finding and by whatever access the route waits on. The holder of the `routes` charter writes `routes.json`; after that, route status changes go through `qa.ts route-status`. The close succeeds once every route has a source and each pending route has its charter.

## Inventory one route

Charter kind `inventory`, one route per charter. Work as each available identity that reaches the route.

**Sections first.** Split the page into the regions a user would name: header, navigation, a form, a table, a dialog. Each section gets a slug, a title and a locator that scopes its elements. An empty locator means the whole page.

**Shared layout once.** A header, footer or first-visit dialog that appears on every route is inventoried in full on one route, named in the map's notes. Other routes leave it out unless it differs there, and then record only the difference.

**Enumerate from the accessibility tree.** Take Playwright's accessibility snapshot of the route and list every interactive node: buttons, links, text inputs, selects, checkboxes, radios, switches, tabs, menu items, sliders, file inputs, drag handles, sortable headers, and anything with a click, key or pointer handler. A screenshot shows only what is visible; the snapshot is the list. An open modal hides the page behind it from the snapshot, so dismiss it and snapshot again. Then reveal what the first snapshot hides: open each menu and dialog, expand each disclosure, hover what reveals controls, visit the empty and the populated state, scroll lazy regions, check the compact viewport when the layout changes there. Keyboard shortcuts found in source or help text count as interactions.

**Everything inside a dialog is inventoried too.** Opening a dialog is one interaction; each control in it is another, in a section of its own. A dialog recorded only as "opens" leaves its controls out of reach of every scenario.

**Operate each one once** and record what happened: the navigation, the request (method, path pattern, status), the visible change, the dialog or toast.

```json
{ "section": "header", "element": "title", "action": "fill", "role": "textbox",
  "locator": "getByLabel('Title')", "identities": ["owner"], "status": "operated",
  "effect": "Autosave: PUT /api/drafts/:id returns 200, then the status text reads 'Saved'." }
```

One record is one action on one element; an element with two actions has two records. The record's **address** is `route/section/element/action`, here `draft-editor/header/title/fill`: the route is the file's `route`, the rest come from the record. Scenarios drive the app by listing addresses, so pick slugs a reader understands.

- **Actions** are Playwright verbs: `click`, `dblclick`, `fill`, `select`, `check`, `uncheck`, `press`, `hover`, `drag`, `upload`, `focus`, `scroll`. Page-level actions with no element of their own are `navigate`, `reload` and `back`; they sit in a whole-page section and may leave `locator` empty.
- **Repeats.** A list of like items (accordion questions, table rows, class cards) gets one record per item only when the items behave differently; otherwise one record for a representative item, with the count in the effect. One dialog opened from several places gets one record per trigger, and its contents are recorded once.

Every interaction ends in one of four states:

- `operated`: performed, with the observed effect.
- `deferred`: operating it writes data, so only a scenario that owns the fixture performs it. The effect states what is expected and the condition. Scenarios may list deferred addresses; the run that first operates one updates the record to `operated`.
- `skipped`: this suite never operates it: outbound messages, payments, publication, leaving for another site. The effect gives the reason.
- `barrier`: Playwright cannot perform it. Write the note per [barriers.md](barriers.md) and put its ID in `barrier`.

**Writing while inventorying.** Operating an element that writes needs test-owned data. Record the write before making it (`qa.ts spend`), record what it left (`qa.ts fixture`), and mark the data as test data where the app allows (a `QA ` name prefix); where it does not, the fixture record's ID is the marker.

**Destructive controls get their own step.** Operate a delete, reset or replace as a separate script step with nothing after it, and read the request log before continuing. Never assume it cleans up: a "delete" may create a replacement. If data the charter still needs would be destroyed, mark the control `deferred` instead.

Set the route's status and check the result:

```text
node <skill>/scripts/qa.ts route-status <qa-root> <route> inventoried
node <skill>/scripts/qa.ts interactions <qa-root>            every route: counts by state
node <skill>/scripts/qa.ts interactions <qa-root> <route>    one route: each address, state, locator and effect by section
```

The charter closes when the route has no pending interaction. `examples/routes.json` and `examples/interactions.json` show complete files.

## Observations are not verdicts

While operating, you will see things that look wrong: a button that does nothing, a 500, a control visible to the wrong role. Record the effect exactly as observed and park it as one fog line (`qa.ts chart-add` with `{ "addFog": ["..."] }`). Judging it needs the capability's rules, which do not exist yet. Reproducing and filing it now would abandon the inventory.

## Swarm

Route inventories are independent wherever their identities and fixtures are: give each worker one `inventory` charter at a time, its own browser context and its own fixture namespace, per [swarm.md](swarm.md). Routes that share one mutable account, one single-fixture identity or a live room go to one worker in sequence. Each worker writes only its own `interactions/<route>.json`; everything shared changes through the helper.
