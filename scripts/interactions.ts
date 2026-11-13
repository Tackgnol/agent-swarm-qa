import assert from 'node:assert/strict';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fingerprint, readJson, safeId } from './store.ts';
import type { Interaction, PathMap, Route, RouteInteractions, RouteInventory } from './models.ts';

const routeStatuses = ['pending', 'inventoried', 'unreachable', 'excluded'];
const interactionStatuses = ['pending', 'operated', 'deferred', 'skipped', 'barrier'];
/** Playwright verbs for elements, plus page-level actions that have no element of their own. */
const actions = ['click', 'dblclick', 'fill', 'select', 'check', 'uncheck', 'press', 'hover', 'drag', 'upload', 'focus', 'scroll', 'navigate', 'reload', 'back'];
const pageActions = ['navigate', 'reload', 'back'];
const playwrightLocator = /^(getBy(Role|Text|Label|Placeholder|AltText|Title|TestId)|locator|frameLocator)\(/;

/** Route inventory; a workspace that predates it reads as empty. */
export function loadRoutes(root: string): RouteInventory {
  const file = join(root, 'routes.json');
  if (!existsSync(file)) {
    return { version: 1, routes: [] };
  }
  const inventory = readJson<RouteInventory>(file);
  assert.ok(inventory.version === 1 && Array.isArray(inventory.routes), 'Unknown routes.json format.');
  const ids = new Set<string>();
  for (const route of inventory.routes) {
    assert.ok(!ids.has(safeId(route.id)), `Duplicate route ID ${route.id}.`);
    ids.add(route.id);
    assert.ok(route.pattern?.trim() && route.title?.trim(), `${route.id} needs a URL pattern and a title.`);
    assert.ok(Array.isArray(route.sources) && route.sources.length > 0, `${route.id} needs at least one source (source, crawl, sitemap, user).`);
    assert.ok(Array.isArray(route.identities), `${route.id} needs the identity aliases that reach it.`);
    assert.ok(routeStatuses.includes(route.status), `${route.id} has an unknown status.`);
    if (route.status === 'unreachable' || route.status === 'excluded') {
      assert.ok(route.reason?.trim(), `${route.id} is ${route.status}: record why.`);
    }
  }
  return inventory;
}

export function barrierIds(root: string): string[] {
  const directory = join(root, 'barriers');
  return existsSync(directory) ? readdirSync(directory).filter(file => file.endsWith('.md')).map(file => file.slice(0, -3)).sort() : [];
}

export function address(route: string, interaction: Pick<Interaction, 'section' | 'element' | 'action'>): string {
  return `${route}/${interaction.section}/${interaction.element}/${interaction.action}`;
}

/** Validate one route's interactions: every element has a section, a Playwright locator and an honest status. */
export function loadRouteInteractions(root: string, routeId: string): RouteInteractions | undefined {
  const file = join(root, 'interactions', `${safeId(routeId)}.json`);
  if (!existsSync(file)) {
    return undefined;
  }
  const entry = readJson<RouteInteractions>(file);
  assert.ok(entry.version === 1 && entry.route === routeId, `interactions/${routeId}.json must name its own route.`);
  assert.ok(Array.isArray(entry.sections) && Array.isArray(entry.interactions), `interactions/${routeId}.json needs sections and interactions.`);
  assert.ok(!Number.isNaN(Date.parse(entry.capturedAt)), `interactions/${routeId}.json needs the actual capture time.`);
  const sections = new Set<string>();
  for (const section of entry.sections) {
    assert.ok(!sections.has(safeId(section.id)), `${routeId}: duplicate section ${section.id}.`);
    sections.add(section.id);
    assert.ok(section.title?.trim(), `${routeId}/${section.id} needs a title.`);
    assert.ok(section.locator === '' || playwrightLocator.test(section.locator), `${routeId}/${section.id}: use a Playwright locator, or an empty string for the whole page.`);
    assert.ok(section.read === undefined || playwrightLocator.test(section.read), `${routeId}/${section.id}: read is a Playwright locator inside the section.`);
  }
  const barriers = new Set(barrierIds(root));
  const addresses = new Set<string>();
  for (const item of entry.interactions) {
    const at = address(routeId, { section: safeId(item.section), element: safeId(item.element), action: safeId(item.action) });
    assert.ok(sections.has(item.section), `${at}: unknown section.`);
    assert.ok(!addresses.has(at), `Duplicate interaction ${at}.`);
    addresses.add(at);
    assert.ok(actions.includes(item.action), `${at}: use one of the actions ${actions.join(', ')}.`);
    assert.ok(typeof item.locator === 'string' && (playwrightLocator.test(item.locator) || (pageActions.includes(item.action) && item.locator === '')), `${at}: store a Playwright locator (getByRole, getByLabel, getByTestId, locator, ...); only navigate, reload and back may leave it empty.`);
    assert.ok(interactionStatuses.includes(item.status), `${at}: unknown status.`);
    if (item.status !== 'pending') {
      assert.ok(item.effect?.trim(), `${at}: record the observed effect, or the reason it was not operated.`);
    }
    assert.ok(item.opens === undefined || sections.has(item.opens), `${at}: opens names a section of this route (${item.opens} is not one).`);
    if (item.status === 'barrier') {
      assert.ok(item.barrier && barriers.has(item.barrier), `${at}: name an existing barrier note (barriers/<id>.md).`);
    }
  }
  return entry;
}

export function loadInteractions(root: string): Map<string, RouteInteractions> {
  const routes = loadRoutes(root);
  const directory = join(root, 'interactions');
  const files = existsSync(directory) ? readdirSync(directory).filter(file => file.endsWith('.json')).map(file => file.slice(0, -5)) : [];
  for (const file of files) {
    assert.ok(routes.routes.some(route => route.id === file), `interactions/${file}.json has no route in routes.json.`);
  }
  const loaded = new Map<string, RouteInteractions>();
  for (const route of routes.routes) {
    const entry = loadRouteInteractions(root, route.id);
    if (entry) {
      loaded.set(route.id, entry);
    }
  }
  return loaded;
}

/** Resolve a route/section/element/action address to an interaction that was actually operated. */
export function resolveOperation(interactions: Map<string, RouteInteractions>, operation: string): Interaction {
  const [route, section, element, action, ...rest] = operation.split('/');
  assert.ok(route && section && element && action && rest.length === 0, `${operation}: an operation is route/section/element/action.`);
  const found = interactions.get(route)?.interactions.find(item => item.section === section && item.element === element && item.action === action);
  assert.ok(found, `${operation}: no such interaction. Inventory the route, or correct the address.`);
  assert.ok(found.status === 'operated' || found.status === 'deferred', `${operation}: only operated or deferred interactions can drive a scenario (this one is ${found.status}).`);
  return found;
}

/** Fingerprint the operating knowledge, ignoring capture times, so a lock can notice later drift. */
export function interactionsHash(root: string): string {
  const routes = loadRoutes(root);
  const interactions = [...loadInteractions(root).entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, { capturedAt, ...content }]) => content);
  return fingerprint({ routes: routes.routes, interactions });
}

export function inventoryGaps(root: string, route: Route): string[] {
  if (route.status === 'pending') {
    return [`Route ${route.id} is still pending: inventory it, or mark it unreachable/excluded with a reason.`];
  }
  if (route.status !== 'inventoried') {
    return [];
  }
  const entry = loadRouteInteractions(root, route.id);
  if (!entry) {
    return [`interactions/${route.id}.json is missing.`];
  }
  const pending = entry.interactions.filter(item => item.status === 'pending').map(item => address(route.id, item));
  const opener = /\b(opens?|shows?|reveals?|expands?)\b[^.]*\b(dialog|modal|drawer|menu|popover|panel|sheet|form)\b/i;
  const unnamed = entry.interactions.filter(item => item.status === 'operated' && !item.opens && opener.test(item.effect)).map(item => address(route.id, item));
  const empty = [...new Set(entry.interactions.filter(item => item.opens).map(item => item.opens!))].filter(id => !entry.interactions.some(item => item.section === id));
  return [
    ...(pending.length ? [`Not yet operated or classified: ${pending.join(', ')}.`] : []),
    ...(unnamed.length ? [`These open a dialog, menu or panel; name the section holding its contents with "opens": ${unnamed.join(', ')}.`] : []),
    ...(empty.length ? [`Opened but not inventoried: section ${empty.join(', ')} has no interactions. Inventory what it contains.`] : []),
  ];
}

/** Low-resolution coverage of the inventory, for the agent and the review document. */
export function interactionSummary(root: string): string {
  const routes = loadRoutes(root);
  const interactions = loadInteractions(root);
  const mapFile = join(root, 'map.json');
  const linked = new Set(existsSync(mapFile) ? readJson<PathMap>(mapFile).paths.flatMap(path => path.routes ?? []) : []);
  const totals = { operated: 0, deferred: 0, skipped: 0, barrier: 0, pending: 0 };
  const lines = routes.routes.map(route => {
    const counts = { operated: 0, deferred: 0, skipped: 0, barrier: 0, pending: 0 };
    for (const item of interactions.get(route.id)?.interactions ?? []) {
      counts[item.status] += 1;
      totals[item.status] += 1;
    }
    const detail = route.status === 'inventoried' || interactions.has(route.id)
      ? `${counts.operated} operated, ${counts.deferred} deferred, ${counts.skipped} skipped, ${counts.barrier} behind barriers, ${counts.pending} pending`
      : route.reason || 'not inventoried yet';
    const waiting = route.pendingIdentities?.length ? ` · still to inventory as ${route.pendingIdentities.join(', ')}` : '';
    return `- ${route.title} (${route.id}, ${route.pattern}) · ${route.status} · ${detail}${waiting}`;
  });
  const unlinked = routes.routes.filter(route => route.status === 'inventoried' && !linked.has(route.id)).map(route => route.title);
  return [
    `Routes: ${routes.routes.length} (${routes.routes.filter(route => route.status === 'pending').length} pending).`,
    `Interactions: ${totals.operated} operated, ${totals.deferred} deferred, ${totals.skipped} skipped, ${totals.barrier} behind barriers, ${totals.pending} pending.`,
    `Barrier notes: ${barrierIds(root).join(', ') || 'none'}.`,
    `Inventoried routes not yet linked to a capability: ${unlinked.join(', ') || 'none'}.`,
    '', ...lines,
  ].join('\n');
}

/** Every address of one route with its status, grouped by section: what a scenario writer or run worker reads instead of the raw file. */
export function routeAddresses(root: string, routeId: string): string {
  const route = loadRoutes(root).routes.find(entry => entry.id === routeId);
  assert.ok(route, `Unknown route ${routeId}.`);
  const entry = loadRouteInteractions(root, routeId);
  assert.ok(entry, `${route.title} has no interactions file yet.`);
  const lines = [`${route.title} (${routeId}, ${route.pattern}) · ${route.status}`];
  for (const section of entry.sections) {
    const items = entry.interactions.filter(item => item.section === section.id);
    lines.push('', `## ${section.title} (${section.id}) · ${section.locator || 'whole page'}`);
    for (const item of items) {
      lines.push(`- ${address(routeId, item)} · ${item.status} · ${item.locator || '(page)'} · ${item.effect.split('\n')[0].slice(0, 140)}`);
    }
  }
  return lines.join('\n');
}
