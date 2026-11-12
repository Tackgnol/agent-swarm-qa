# Learn interactions: routes, elements, operation

This phase produces the **inventory**: every route, every interactive element on it, and how to operate each with Playwright. It is the agent's own work. The user is asked nothing here except to lift a barrier.

The inventory is operating knowledge. It says how to drive the app and what was seen to happen; whether that behavior is correct is settled later, in [functionality.md](functionality.md).

## Driver

Playwright is the driver and its locators are the stored format, so the same record serves a Playwright MCP session, a product's own `@playwright/test` suite and a saved runner. Discover which Playwright is available (browser tools exposed to the agent, the product's install, the environment's install) and record the choice in the map's notes. Log in through a trusted runner or a manually authenticated session per [init.md](init.md), one isolated browser context per identity.

Prefer locators in this order, taking the first that identifies the element uniquely inside its section:

1. `getByRole(role, { name })`
2. `getByLabel`, `getByPlaceholder`, `getByText`, `getByAltText`, `getByTitle`
3. `getByTestId`
4. `locator(css)` as the last resort, with the reason in the effect text

A locator names the element by what every user sees. Where an element is identified by fixture or account data, such as the row for one particular draft, store the structural locator (`getByRole('row')`) and leave the choice of row to the scenario's preconditions. Private values never enter a locator or an effect.

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

`id` is a short slug that reads well inside an address. `identities` lists the aliases that reach the route. `status` starts `pending` and ends as one of:

- `inventoried`: its elements are recorded in `interactions/<id>.json`.
- `unreachable`: found in one source and never reached; the reason says what was tried, for example a missing role or a feature flag.
- `excluded`: reachable and deliberately left out; the reason cites the setup decision or the user's ruling.

A route found in source and missed by the crawl is the interesting case: find how a user gets there before calling it unreachable. A route the crawl found and the source lacks goes in as well.

Before closing, chart one `inventory` charter per pending route (see [wayfinding.md](wayfinding.md)). The close succeeds once every route has a source and each pending route has its charter.

## Inventory one route

Charter kind `inventory`, one route per charter. Work as each identity that reaches the route.

**Sections first.** Split the page into the regions a user would name: header, navigation, a form, a table, a dialog. Each section gets a slug, a title and a locator that scopes its elements. An empty locator means the whole page.

**Enumerate from the accessibility tree.** Take Playwright's accessibility snapshot of the route and list every interactive node: buttons, links, text inputs, selects, checkboxes, radios, switches, tabs, menu items, sliders, file inputs, drag handles, sortable headers, and anything with a click, key or pointer handler. A screenshot shows only what is visible; the snapshot is the list. Then reveal what the first snapshot hides and take it again: open each menu and dialog, expand each disclosure, hover what reveals controls, visit the empty and the populated state, scroll lazy regions, check the compact viewport when the layout changes there. Keyboard shortcuts found in source or help text count as interactions.

**Operate each one once** and record what happened: the navigation, the request (method, path pattern, status), the visible change, the dialog or toast. Use run-owned fixtures for anything that writes.

```json
{ "section": "header", "element": "title", "action": "fill", "role": "textbox",
  "locator": "getByLabel('Title')", "identities": ["owner"], "status": "operated",
  "effect": "Autosave: PUT /api/drafts/:id returns 200, then the status text reads 'Saved'." }
```

One record is one action on one element; an element with two actions has two records. `action` is the Playwright verb: `click`, `fill`, `select`, `check`, `press`, `hover`, `drag`, `upload`. The record's **address** is `route/section/element/action`, here `draft-editor/header/title/fill`. Scenarios drive the app by listing addresses, so pick slugs a reader understands.

Every interaction ends in one of three states:

- `operated`: performed, with the observed effect.
- `skipped`: left alone because operating it outside a scenario would break the agreed effects: irreversible deletes, payments, outbound email, publication, anything touching data the run does not own. The effect text gives the reason and the condition under which a scenario may operate it.
- `barrier`: Playwright cannot perform it. Write the note per [barriers.md](barriers.md) and put its ID in `barrier`.

Set the route to `inventoried` and check the result:

```text
node <skill>/scripts/qa.ts interactions <qa-root>
```

The summary counts operated, skipped, barrier and pending interactions per route and lists inventoried routes that no capability links yet. The charter closes when the route has no pending interaction. `examples/routes.json` and `examples/interactions.json` show complete files.

## Observations are not verdicts

While operating, you will see things that look wrong: a button that does nothing, a 500, a control visible to the wrong role. Record the effect exactly as observed and add one fog line or a `task` charter naming it. Judging it needs the capability's rules, which do not exist yet. Reproducing and filing it now would abandon the inventory.

## Swarm

Route inventories are independent wherever their identities and fixtures are: give each worker one `inventory` charter, its own browser context and its own fixture namespace, per [swarm.md](swarm.md). Routes that share one mutable account or a live room go to one worker in sequence. The parent alone writes `routes.json`; each worker writes only its own `interactions/<route>.json`.
