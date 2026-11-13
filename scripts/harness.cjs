// Runner harness shipped with the skill. CommonJS, because scripts under a QA root are run as .cjs.
// A runner requires it by absolute path:  const qa = require('<skill>/scripts/harness.cjs');
// App-specific helpers (login, consent dialogs) belong in the product's <qa-root>/runners/lib/, built on top of this.
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const HELPER = path.join(__dirname, 'qa.ts');

function helper(args) {
  try {
    return execFileSync(process.execPath, [HELPER, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  } catch (error) {
    throw new Error(String(error.stderr || error.message).trim());
  }
}

/** Replace UUIDs and long numeric ids so evidence carries path patterns, never identifiers. */
function mask(text) {
  return String(text)
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ':id')
    .replace(/\/\d{4,}(?=\/|$|\?)/g, '/:id');
}

/**
 * Record what the page talks to: same-origin API responses, every host requested, every failed request.
 * log.since(marker) lists API lines after a Date.now() marker; log.writes() the non-GET ones; log.trouble() any 429 or 5xx.
 */
function track(page, { baseUrl, apiPrefix = '/api' }) {
  const origin = new URL(baseUrl).origin;
  const log = { api: [], hosts: new Set(), failedHosts: new Set() };
  page.on('request', request => { try { log.hosts.add(new URL(request.url()).host); } catch { /* data: and blob: urls */ } });
  page.on('requestfailed', request => { try { log.failedHosts.add(new URL(request.url()).host); } catch { /* ignore */ } });
  page.on('response', response => {
    const url = new URL(response.url());
    if (url.origin === origin && url.pathname.startsWith(apiPrefix)) {
      log.api.push({ method: response.request().method(), path: url.pathname, status: response.status(), at: Date.now() });
    }
  });
  const line = entry => `${entry.method} ${mask(entry.path)} ${entry.status}`;
  log.since = (marker = 0) => log.api.filter(entry => entry.at >= marker).map(line);
  log.writes = (marker = 0) => log.api.filter(entry => entry.at >= marker && !['GET', 'HEAD', 'OPTIONS'].includes(entry.method)).map(line);
  log.trouble = (marker = 0) => log.api.filter(entry => entry.at >= marker && (entry.status === 429 || entry.status >= 500)).map(line);
  return log;
}

/** Launch a browser and one isolated context: a separate identity. Pass storageState to resume one. */
async function session({ baseUrl, viewport = { width: 1440, height: 900 }, storageState, apiPrefix } = {}) {
  const { chromium } = require('playwright');
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport, storageState });
  const page = await context.newPage();
  return { browser, context, page, baseUrl, log: track(page, { baseUrl, apiPrefix }), viewport: `${viewport.width}x${viewport.height}` };
}

/** Navigate and return once the document is parsed. Readiness of the content is the runner's own explicit wait. */
async function open(current, route) {
  await current.page.goto(route.startsWith('http') ? route : current.baseUrl + route, { waitUntil: 'domcontentloaded', timeout: 60000 });
}

/** A dialog found by its visible text: many dialogs have no accessible name. */
function dialog(page, text) {
  return page.getByRole('dialog').filter({ hasText: text });
}

/** Read an API path with the page's own session. context.request and plain fetch may bypass a session proxy. */
async function apiGet(page, apiPath) {
  return page.evaluate(async target => {
    const response = await fetch(target, { credentials: 'include' });
    return { status: response.status, body: await response.json().catch(() => null) };
  }, apiPath);
}

function readList(file) {
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : [];
}

/** The number the next recorded attempt of this scenario gets in this lane. */
function nextAttempt(laneDir, scenarioId) {
  return readList(path.join(laneDir, 'results.json')).filter(entry => entry.scenarioId === scenarioId).length + 1;
}

/** Screenshot into the run's gallery. The attempt number is part of the name, so a later attempt never overwrites an earlier one. */
async function shot(page, runDir, laneDir, scenarioId, state, caption) {
  const relative = path.join('screenshots', `${path.basename(laneDir)}-${scenarioId}-a${nextAttempt(laneDir, scenarioId)}-${state}.png`);
  fs.mkdirSync(path.join(runDir, 'screenshots'), { recursive: true });
  await page.screenshot({ path: path.join(runDir, relative) });
  return { path: relative, caption, inspected: false };
}

/**
 * Append one attempt: an execution of the scenario and what was observed. Never edit a recorded attempt;
 * a correction is a new attempt with a resolution ({ kind: 'harness-corrected' | 'check-corrected' | 'expected-behavior', reason }).
 */
function record(laneDir, { scenarioId, status, actual, viewport, boundary, locale = 'en', browser = 'chromium', evidence = [], screenshots = [], resolution }) {
  if (!['passed', 'failed', 'blocked', 'not-run', 'inconclusive'].includes(status)) { throw new Error(`Unknown status ${status}.`); }
  if (!scenarioId || !String(actual || '').trim() || !String(boundary || '').trim() || !viewport) { throw new Error('An attempt needs a scenario, what was actually observed, the viewport and the boundary exercised.'); }
  fs.mkdirSync(laneDir, { recursive: true });
  const file = path.join(laneDir, 'results.json');
  const results = readList(file);
  const result = { scenarioId, attempt: nextAttempt(laneDir, scenarioId), status, at: new Date().toISOString(), actual, browser, viewport, locale, boundary, screenshots, evidence };
  if (resolution) { result.resolution = resolution; }
  results.push(result);
  fs.writeFileSync(file, `${JSON.stringify(results, null, 2)}\n`);
  return result;
}

/** A runner crash or a bug in the runner's own code. It is logged beside the results and is NOT an attempt at the scenario. */
function runnerError(laneDir, scenarioId, message) {
  fs.mkdirSync(laneDir, { recursive: true });
  const file = path.join(laneDir, 'harness-log.json');
  const entries = readList(file);
  entries.push({ scenarioId, at: new Date().toISOString(), message: String(message) });
  fs.writeFileSync(file, `${JSON.stringify(entries, null, 2)}\n`);
}

/** Call BEFORE a step that writes to the target. Throws when the agreed budget is spent: stop the lane and report. */
function spend(qaRoot, who, what) {
  return helper(['spend', qaRoot, who, what]);
}

/** Note test data left on the target (cleanup: pending, done or handed-off). Call right after the write, before anything else can fail. */
function fixture(qaRoot, id, owner, note, cleanup = 'pending') {
  return helper(['fixture', qaRoot, id, owner, note, cleanup]);
}

/** Guard a step that must happen once across every attempt and replay (sending a real message). True the first time only. */
function once(laneDir, key) {
  fs.mkdirSync(laneDir, { recursive: true });
  try {
    fs.writeFileSync(path.join(laneDir, `${key}.done`), new Date().toISOString(), { flag: 'wx' });
    return true;
  } catch {
    return false;
  }
}

/** The workspace's private folder: saved browser sessions, mailbox logins, anything never shown in a report. */
function privatePath(qaRoot, name) {
  const directory = path.join(qaRoot, 'private');
  fs.mkdirSync(directory, { recursive: true });
  return path.join(directory, name);
}

/** Save a session's cookies and storage under private/, so later scripts resume the same identity and fixture. */
async function saveState(current, qaRoot, name) {
  const file = privatePath(qaRoot, `${name}.json`);
  await current.context.storageState({ path: file });
  return file;
}

const locatorStart = /^(getBy(Role|Text|Label|Placeholder|AltText|Title|TestId)|locator|frameLocator)\(/;
const locatorForbidden = /;|`|=>|\b(require|import|process|eval|Function|globalThis|constructor|prototype|window|document)\b/;

/** Turn a locator stored in the inventory into a Playwright locator, relative to a page or another locator. */
function locate(base, expression) {
  if (expression === '') { return base.locator(':root'); }
  if (!locatorStart.test(expression) || locatorForbidden.test(expression)) {
    throw new Error(`Not a stored Playwright locator: ${expression}`);
  }
  return new Function('base', `return base.${expression};`)(base);
}

/**
 * Read the state of named sections of a route: visible text plus form values, whitespace-normalized.
 * entry is the route's interactions file. A section's `read` locator narrows what is read.
 */
async function sectionStates(page, entry, ids) {
  const states = {};
  for (const id of ids) {
    const section = entry.sections.find(item => item.id === id);
    if (!section) { throw new Error(`${entry.route} has no section ${id}.`); }
    const scope = section.locator ? locate(page, section.locator) : page.locator(':root');
    const target = section.read ? locate(scope, section.read) : scope;
    const parts = await target.evaluateAll(elements => elements.map(element => {
      const values = [...element.querySelectorAll('input, select, textarea')].map(field => (field.type === 'checkbox' || field.type === 'radio') ? String(field.checked) : field.value);
      if (element.matches('input, select, textarea')) { values.unshift(element.value); }
      return `${element.innerText}\u0000${values.join('\u0001')}`;
    }));
    states[id] = parts.join('\u0002').replace(/[ \t]+/g, ' ').replace(/\s*\n\s*/g, '\n').trim();
  }
  return states;
}

/** Which sections differ between two sectionStates() readings. */
function changedSections(before, after) {
  return Object.keys({ ...before, ...after }).filter(id => before[id] !== after[id]);
}

module.exports = { changedSections, locate, privatePath, saveState, sectionStates, apiGet, dialog, fixture, mask, nextAttempt, once, open, record, runnerError, session, shot, spend, track };
