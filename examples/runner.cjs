// Example scenario runner built on the shipped harness. Unapproved illustration: adapt it to the real product.
// Run:  node <qa-root>/runners/QA-001.cjs <qa-root> <run-dir> <lane-dir>
const qa = require('/path/to/agent-swarm-qa/scripts/harness.cjs');

const SCENARIO = 'QA-001';
const BOUNDARY = 'Deployed UI plus real API persistence';

(async () => {
  const [qaRoot, runDir, laneDir] = process.argv.slice(2);
  const lane = require('node:path').basename(laneDir);
  const s = await qa.session({ baseUrl: 'https://canary.example.test' });
  try {
    // Steps that write nothing come first, so the runner can be built and checked without spending the budget.
    await qa.open(s, '/drafts');
    await s.page.getByRole('heading', { name: 'Drafts' }).waitFor();

    // One write: record it before making it, and record what it left right after.
    qa.spend(qaRoot, lane, `${SCENARIO} creates one draft`);
    await s.page.getByRole('button', { name: 'New draft' }).click();
    await s.page.waitForURL(/\/drafts\/\d+/);
    const draftId = new URL(s.page.url()).pathname.split('/').pop();
    qa.fixture(qaRoot, `draft-${draftId}`, lane, `${SCENARIO}: run-owned draft`);

    const marker = Date.now();
    await s.page.getByRole('banner').getByLabel('Title').fill('QA saved title');
    await s.page.getByText('Saved').waitFor();
    await s.page.reload({ waitUntil: 'domcontentloaded' });
    const title = await s.page.getByRole('banner').getByLabel('Title').inputValue();
    const read = await qa.apiGet(s.page, `/api/drafts/${draftId}`);
    const image = await qa.shot(s.page, runDir, laneDir, SCENARIO, 'after-reload', 'Draft title after reload');

    const kept = title === 'QA saved title' && read.body?.title === 'QA saved title';
    qa.record(laneDir, {
      scenarioId: SCENARIO, status: s.log.trouble(marker).length ? 'inconclusive' : kept ? 'passed' : 'failed', viewport: s.viewport, boundary: BOUNDARY,
      actual: kept ? 'The new title was shown after reload and returned by an independent read.' : `After reload the field read "${title}" and the API returned "${read.body?.title}".`,
      evidence: [...s.log.since(marker), ...s.log.trouble(marker).map(line => `Service trouble: ${line}`)],
      screenshots: [image],
    });

    // Cleanup the app allows: do it, verify it, and mark the fixture done.
    await s.page.getByRole('region', { name: 'Danger zone' }).getByRole('button', { name: 'Delete draft' }).click();
    await s.page.waitForURL(/\/drafts$/);
    qa.fixture(qaRoot, `draft-${draftId}`, lane, `${SCENARIO}: deleted and verified absent`, 'done');
  } catch (error) {
    // A crash in the runner is not an attempt at the scenario.
    qa.runnerError(laneDir, SCENARIO, error.stack || error.message);
    process.exitCode = 1;
  } finally {
    await s.browser.close();
  }
})();
