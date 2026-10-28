import assert from 'node:assert/strict';
import { existsSync, readFileSync, realpathSync, readdirSync, mkdirSync, statSync, writeFileSync } from 'node:fs';
import { extname, join, relative } from 'node:path';
import { suiteFingerprint, inside, readJson, readRun, writeJson } from './workspace.ts';
import type { Config, PathMap, Report, Result, Run, Scenario, Status, Suite } from './models.ts';

function effectiveStatus(attempts: Result[], approvedBoundary: string): Status {
  if (attempts.length === 0) {
    return 'not-run';
  }
  const last = attempts.at(-1)!;
  if (['passed', 'failed'].includes(last.status) && last.boundary.trim() !== approvedBoundary.trim()) {
    return 'inconclusive';
  }
  if (last.status === 'passed' && last.evidence.length === 0 && !last.screenshots.some(item => item.inspected)) {
    return 'inconclusive';
  }
  if (last.status === 'passed' && attempts.some(item => item.status === 'failed') && !last.resolution?.reason?.trim()) {
    return 'inconclusive';
  }
  return last.status;
}

/** One result model feeds JSON, Markdown and HTML so counts and verdicts cannot drift. */
export function buildReport(suite: Suite, run: Run, results: Result[]): Report {
  const target = suite.config.environments.find(env => env.name === run.environment) ?? { name: run.environment, appUrl: 'Not configured' };
  const cases = suite.scenarios.map(scenario => {
    const attempts = results.filter(item => item.scenarioId === scenario.id).sort((a, b) => a.attempt - b.attempt);
    return { scenario, status: effectiveStatus(attempts, scenario.boundary), attempts };
  });
  const counts: Report['counts'] = { passed: 0, failed: 0, blocked: 0, 'not-run': 0, inconclusive: 0 };
  for (const entry of cases) {
    counts[entry.status] += 1;
  }
  const reasons: string[] = [];
  const blockers = cases.filter(entry => entry.scenario.critical && entry.status === 'failed');
  const gaps = cases.filter(entry => entry.scenario.critical && entry.status !== 'passed' && entry.status !== 'failed');
  if (blockers.length) {
    reasons.push(`Critical failures: ${blockers.map(entry => entry.scenario.id).join(', ')}.`);
  }
  if (gaps.length) {
    reasons.push(`Critical coverage is incomplete: ${gaps.map(entry => entry.scenario.id).join(', ')}.`);
  }
  if (!run.observedBuild.trim() || run.observedBuild.trim().toLowerCase() === 'unverified') {
    reasons.push('The running build has not been observed.');
  }
  if (run.openQuestions.length) {
    reasons.push('Specification questions are still open.');
  }
  if (cases.some(entry => entry.status === 'inconclusive')) {
    reasons.push('Some observations remain inconclusive: check unresolved failure/pass pairs and whether the actual test boundary matches the approved one.');
  }
  if (run.fixtures.some(item => item.cleanup === 'pending')) {
    reasons.push('Run-owned fixture cleanup is pending.');
  }
  if (run.phase === 'planning' || cases.length === 0 || cases.every(entry => entry.attempts.length === 0)) {
    reasons.push('This is a plan, not an executed QA run.');
  }
  const recommendation: Report['recommendation'] = blockers.length ? 'hold' : reasons.length ? 'readiness-unproven' : 'ready-for-tested-scope';
  if (recommendation === 'ready-for-tested-scope') {
    reasons.push('All approved critical scenarios passed at the recorded boundary; optional gaps and findings remain listed. This does not authorize deployment.');
  }
  return {
    version: 1, generatedAt: new Date().toISOString(), project: suite.config.project, run, target,
    suiteHash: suite.hash, recommendation, reasons, counts, cases,
    paths: suite.map.paths, coverage: suite.config.coverage,
    identities: suite.config.identities.map(({ alias, kind, role }) => ({ alias, kind, role })),
    issueStorage: suite.config.issues,
    excludedPaths: suite.map.paths.filter(entry => entry.disposition === 'excluded'),
  };
}

function html(value: unknown): string {
  return String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!);
}

function list(items: string[]): string {
  if (items.length === 0) {
    return '<p class="meta">None recorded.</p>';
  }
  return `<ul>${items.map(item => `<li>${html(item)}</li>`).join('')}</ul>`;
}

/** Embed inspected raster captures only, within the run, with a bounded portable report size. */
function screenshot(directory: string, item: Result['screenshots'][number], budget: { used: number }): string {
  const caption = `<figcaption>${html(item.caption)} <code>${html(item.path)}</code></figcaption>`;
  if (!item.inspected) {
    return `<figure class="missing">Not visually inspected; excluded from the gallery.${caption}</figure>`;
  }
  try {
    const isPrivate = (path: string): boolean => path.replaceAll('\\', '/').split('/').some(part => part.toLowerCase() === 'private');
    assert.ok(!isPrivate(item.path), 'Private artifacts are not report images.');
    const path = inside(directory, item.path);
    const actualRoot = realpathSync(directory);
    const actualPath = realpathSync(path);
    inside(actualRoot, actualPath);
    assert.ok(!isPrivate(relative(actualRoot, actualPath)), 'Private symlink targets are not report images.');
    const extension = extname(path).toLowerCase();
    const mime = ({ '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' } as Record<string, string>)[extension];
    assert.ok(mime, 'Only raster screenshots can be embedded.');
    const size = statSync(path).size;
    assert.ok(size <= 8 * 1024 * 1024 && budget.used + size <= 64 * 1024 * 1024, 'Image budget exceeded.');
    const data = readFileSync(path);
    budget.used += size;
    return `<figure><img loading="lazy" src="data:${mime};base64,${data.toString('base64')}" alt="${html(item.caption)}">${caption}</figure>`;
  } catch {
    return `<figure class="missing">Image unavailable, unsafe, or over the report image budget. Review the local capture separately.${caption}</figure>`;
  }
}

const styles = `:root{font-family:system-ui,sans-serif;color:#17232c;background:#f4f2eb;font-synthesis:none}*{box-sizing:border-box}body{margin:0}main{max-width:1180px;margin:auto;padding:40px 24px}h1{font-family:Georgia,serif;font-size:clamp(2.4rem,6vw,4.4rem);line-height:1.05;margin:12px 0}h2{font-size:1.4rem;margin-top:38px}h3{margin:0 0 12px}p,li{line-height:1.6}a{color:#075985}code{font-size:.88em;overflow-wrap:anywhere}header{border-top:6px solid #075985;padding-top:20px}.eyebrow{text-transform:uppercase;letter-spacing:.12em;font-size:.8rem}.summary{display:flex;gap:12px;flex-wrap:wrap;margin:24px 0}.metric{padding:12px 18px;background:white;border:1px solid #d5d8d7}.metric strong{font-size:1.8rem;display:block}.badge{display:inline-block;padding:5px 10px;border:1px solid currentColor;font-size:.85rem;font-weight:700}.passed,.ready-for-tested-scope{color:#14532d;background:#f0fdf4}.failed,.hold{color:#991b1b;background:#fff1f2}.blocked,.inconclusive,.readiness-unproven{color:#78350f;background:#fffbeb}.not-run{color:#334155;background:#f1f5f9}.card{background:#fff;border:1px solid #cdd3d5;padding:22px;margin:18px 0;break-inside:avoid}.columns{display:grid;grid-template-columns:1fr 1fr;gap:24px}.meta{font-size:.88rem;color:#40515e}table{border-collapse:collapse;width:100%;background:white}td,th{text-align:left;padding:12px;border-bottom:1px solid #d5d8d7;vertical-align:top;overflow-wrap:anywhere}th{font-size:.8rem;text-transform:uppercase}figure{margin:18px 0;border:1px solid #d5d8d7;padding:10px}img{display:block;max-width:100%;height:auto;max-height:640px;object-fit:contain;object-position:left top}figcaption{font-size:.85rem;margin-top:8px}.missing{background:#fffbeb;color:#78350f}details{margin-top:16px}summary{cursor:pointer;font-weight:650;padding:8px 0}.table-wrap{overflow:auto}nav{display:flex;gap:16px;flex-wrap:wrap;margin:20px 0}.notice{border-left:4px solid #a16207;padding:8px 16px;background:#fffbeb}@media(max-width:680px){main{padding:24px 14px}.columns{grid-template-columns:1fr}.card{padding:16px}}@media print{body{background:white}main{padding:0;max-width:none}details{display:block}nav{display:none}img{max-height:none}a{color:inherit}.card{break-inside:auto}}`;

export function renderHtml(report: Report, directory: string): string {
  const budget = { used: 0 };
  const cards = report.cases.map(({ scenario, status, attempts }) => `<article class="card" id="case-${html(scenario.id)}">
    <span class="badge ${status}">${status}</span> <span class="meta">${html(scenario.id)} · ${scenario.critical ? 'Critical' : 'Optional'} · ${html(scenario.pathId)}</span>
    <h2>${html(scenario.title)}</h2><p class="meta">${html(scenario.boundary)} · identities: ${html(scenario.identities.join(', '))}</p>
    <div class="columns"><section><h3>Scenario</h3>${list(scenario.preconditions)}<ol>${scenario.steps.map(step => `<li>${html(step)}</li>`).join('')}</ol></section><section><h3>Expected</h3>${list(scenario.expected)}<h3>Required evidence</h3>${list(scenario.evidence ?? [])}</section></div>
    ${attempts.length === 0 ? '<p class="notice">Not run. No passing result is implied.</p>' : attempts.map(attempt => `<section><h3>Attempt ${attempt.attempt}: ${html(attempt.status)}</h3><p>${html(attempt.actual)}</p><p class="meta">${html(attempt.at)} · ${html(attempt.browser)} · ${html(attempt.viewport)} · ${html(attempt.locale)} · ${html(attempt.boundary)}</p>${list(attempt.evidence)}${attempt.resolution ? `<p class="notice">${html(attempt.resolution.kind)}: ${html(attempt.resolution.reason)}</p>` : ''}${attempt.screenshots.map(item => screenshot(directory, item, budget)).join('')}</section>`).join('')}
    <details><summary>Approval and cleanup contract</summary><p>${html(scenario.approval?.decisionRef ?? 'Not approved')}</p>${list(scenario.cleanup)}</details>
  </article>`).join('');
  const findings = report.run.findings.map(item => `<tr><td>${html(item.id)}</td><td>${html(item.title)}</td><td>${html(item.kind)}</td><td>${html(item.impact)}</td><td>${html(item.scenarioIds.join(', '))}</td><td>${item.issueUrl && /^https?:\/\//.test(item.issueUrl) ? `<a href="${html(item.issueUrl)}" rel="noreferrer">Issue</a>` : 'Local / pending'}</td></tr>`).join('');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"><title>${html(report.project)} — QA ${html(report.run.id)}</title><style>${styles}</style></head><body><main>
    <header><div class="eyebrow">Agent Swarm QA · ${html(report.run.phase)}</div><h1>${html(report.project)}<br>QA evidence report</h1><span class="badge ${report.recommendation}">${html(report.recommendation)}</span>${list(report.reasons)}<p class="meta">Run ${html(report.run.id)} · ${html(report.generatedAt)}</p></header>
    <nav><a href="#scope">Scope & build</a><a href="#scenarios">Scenarios</a><a href="#findings">Findings</a><a href="#automation">Automation</a><a href="#cleanup">Cleanup & limits</a></nav>
    <div class="summary">${Object.entries(report.counts).map(([status, count]) => `<div class="metric"><strong>${count}</strong>${html(status)}</div>`).join('')}</div>
    <section id="scope"><h2>Scope & build</h2><p>Target: ${html(report.target.appUrl)}<br>Environment: ${html(report.target.name)}<br>Observed build: ${html(report.run.observedBuild)}</p><p class="meta">Suite SHA-256: <code>${html(report.suiteHash)}</code></p><details><summary>Approved matrix, identities and mapped paths</summary><p>Browsers: ${html(report.coverage.browsers.join(', ') || 'Undecided')}<br>Viewports: ${html(report.coverage.viewports.join(', ') || 'Undecided')}<br>Locales: ${html(report.coverage.locales.join(', ') || 'Undecided')}</p>${list(report.identities.map(identity => `${identity.alias}: ${identity.kind}, ${identity.role}`))}${list(report.paths.map(path => `${path.id} · ${path.route} · ${path.title} · ${path.disposition}`))}</details><h3>Excluded paths</h3>${list(report.excludedPaths.map(path => `${path.title}: ${path.reason}`))}<h3>Open questions</h3>${list(report.run.openQuestions)}</section>
    <section id="scenarios"><h2>Scenario evidence</h2>${cards || '<p>No scenarios approved or executed yet.</p>'}</section>
    <section id="findings"><h2>Findings</h2><p class="meta">Storage: ${html(report.issueStorage.provider)} · ${html(report.issueStorage.destination || 'Undecided')} · mode: ${html(report.issueStorage.mode)}</p><div class="table-wrap"><table><thead><tr><th>ID</th><th>Finding</th><th>Kind</th><th>Impact</th><th>Cases</th><th>Tracker</th></tr></thead><tbody>${findings || '<tr><td colspan="6">No findings recorded. This does not establish full coverage.</td></tr>'}</tbody></table></div></section>
    <section id="automation"><h2>Automation & contract fuzzing</h2><p>Counts below use different units and are not added to the scenario totals.</p>${list(report.run.automated.map(item => `${item.name} [${item.boundary}]: ${item.passed} passed / ${item.failed} failed / ${item.skipped} skipped. Log: ${item.log}`))}${list(report.run.fuzzing.map(item => `${item.name}: ${item.executed} executed; raw ${item.rawErrors} errors / ${item.rawWarnings} warnings; ${item.confirmedDefects} confirmed defects. Log: ${item.log}`))}</section>
    <section id="cleanup"><h2>Cleanup & limits</h2>${list(report.run.fixtures.map(item => `${item.id} · ${item.owner} · ${item.cleanup}: ${item.note}`))}${list(report.run.limits)}<p class="notice">A locked suite records agreed expectations, not a passing release. This report authorizes no publication or deployment. Only inspected, local raster screenshots are embedded; private artifacts remain separate.</p></section>
    </main></body></html>`;
}

export function renderMarkdown(report: Report): string {
  const lines = [
    `# ${report.project}: QA ${report.run.id}`, '', `Recommendation: **${report.recommendation}**`, '',
    ...report.reasons.map(reason => `- ${reason}`), '', '## Scope & build', '',
    `Target: ${report.target.appUrl}`, `Observed build: ${report.run.observedBuild}`, `Suite: ${report.suiteHash}`, '',
    `Browsers: ${report.coverage.browsers.join(', ') || 'Undecided'}; viewports: ${report.coverage.viewports.join(', ') || 'Undecided'}; locales: ${report.coverage.locales.join(', ') || 'Undecided'}`, '',
    ...report.paths.map(path => `- ${path.id}: ${path.route} — ${path.title} (${path.disposition})`), '',
    '## Scenario results', '', ...Object.entries(report.counts).map(([status, count]) => `- ${status}: ${count}`), '',
  ];
  for (const entry of report.cases) {
    lines.push(`### ${entry.scenario.id}: ${entry.scenario.title}`, '', `Status: ${entry.status}; critical: ${entry.scenario.critical}`, '',
      'Expected:', ...entry.scenario.expected.map(item => `- ${item}`), '',
      ...entry.attempts.flatMap(item => [`Attempt ${item.attempt}: ${item.status} — ${item.actual}`, `Boundary: ${item.boundary}; ${item.browser}; ${item.viewport}; ${item.locale}`, ...item.evidence.map(value => `- ${value}`), ...item.screenshots.map(image => `- Screenshot: ${image.path} (${image.inspected ? 'inspected' : 'uninspected'})`), '']));
  }
  const evidence = report.cases.flatMap(entry => entry.attempts.flatMap(attempt => [
    ...attempt.evidence.map(item => `- ${entry.scenario.id} attempt ${attempt.attempt}: ${item}`),
    ...attempt.screenshots.map(item => `- ${entry.scenario.id}: ${item.path} — ${item.caption} (${item.inspected ? 'inspected' : 'uninspected'})`),
  ]));
  lines.push('## Evidence', '', ...(evidence.length ? evidence : ['No execution evidence recorded.']), '',
    '## Findings', '', ...report.run.findings.map(item => `- ${item.id}: ${item.title} [${item.kind}; ${item.impact}] ${item.issueUrl ?? '(local)'}`), '',
    '## Automated suites', '', ...report.run.automated.map(item => `- ${item.name} [${item.boundary}]: ${item.passed} passed, ${item.failed} failed, ${item.skipped} skipped. ${item.log}`), '',
    '## Contract fuzzing', '', ...report.run.fuzzing.map(item => `- ${item.name}: ${item.executed} executed; raw errors ${item.rawErrors}; raw warnings ${item.rawWarnings}; confirmed defects ${item.confirmedDefects}. ${item.log}`), '',
    '## Cleanup', '', ...report.run.fixtures.map(item => `- ${item.id}: ${item.cleanup}; ${item.owner}; ${item.note}`), '',
    '## Limits & open questions', '', ...report.run.limits.map(item => `- ${item}`), ...report.run.openQuestions.map(item => `- Question: ${item}`), ...report.excludedPaths.map(item => `- Excluded ${item.id}: ${item.reason}`), '',
    'A locked suite is an agreed contract, not a release approval. See report.html for the inline screenshot gallery.', '');
  return lines.join('\n');
}

export function writeReport(root: string, id: string): string {
  const { directory, suite, run, results } = readRun(root, id);
  const report = buildReport(suite, run, results);
  writeJson(join(directory, 'report.json'), report);
  writeFileSync(join(directory, 'report.md'), renderMarkdown(report), 'utf8');
  writeFileSync(join(directory, 'report.html'), renderHtml(report, directory), 'utf8');
  return join(directory, 'report.html');
}

/** Planning reports use current drafts, never the execution or lock-in gate. */
export function writePlanningReport(root: string): string {
  const directory = join(root, 'planning');
  mkdirSync(directory, { recursive: true });
  const config = readJson<Config>(join(root, 'config.json'));
  const map = readJson<PathMap>(join(root, 'map.json'));
  const scenarios = readdirSync(join(root, 'scenarios')).filter(file => file.endsWith('.json')).sort().map(file => readJson<Scenario>(join(root, 'scenarios', file)));
  const suite: Suite = { config, map, scenarios, hash: suiteFingerprint(config, map, scenarios) };
  const checkpoint = existsSync(join(root, 'checkpoint.json')) ? readJson<{ pendingQuestions?: string[] }>(join(root, 'checkpoint.json')) : {};
  const questions = (checkpoint.pendingQuestions ?? []).filter(question => typeof question === 'string');
  const run: Run = { version: 1, id: 'planning', phase: 'planning', createdAt: new Date().toISOString(), environment: config.environments[0]?.name ?? 'Unconfigured', observedBuild: 'unverified', suiteHash: suite.hash, openQuestions: questions.length ? questions : ['Setup and/or scenario review is incomplete.'], fixtures: [], findings: [], limits: ['Planning snapshot only. No checks have been executed.', `Issue storage: ${config.issues.provider}; write mode: ${config.issues.mode}.`], automated: [], fuzzing: [] };
  const report = buildReport(suite, run, []);
  writeJson(join(directory, 'report.json'), report);
  writeFileSync(join(directory, 'report.md'), renderMarkdown(report), 'utf8');
  writeFileSync(join(directory, 'report.html'), renderHtml(report, directory), 'utf8');
  return join(directory, 'report.html');
}
