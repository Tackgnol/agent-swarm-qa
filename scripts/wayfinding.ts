import assert from 'node:assert/strict';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { barrierIds } from './interactions.ts';
import { readJson, safeId, writeJson } from './store.ts';
import type { Chart, Charter, CharterKind, Lock } from './models.ts';

const kinds: CharterKind[] = ['setup', 'routes', 'inventory', 'intent', 'scenarios', 'run', 'lock', 'task'];

/** Where a claimed charter sends the agent, and the criterion its close is checked against. */
export function guide(charter: Charter): { reference: string; doneWhen: string } {
  switch (charter.kind) {
    case 'setup': return { reference: 'references/init.md', doneWhen: 'The destination is named and the user confirmed the setup (qa.ts approve <qa-root> setup <decision-ref>).' };
    case 'routes': return { reference: 'references/interactions.md', doneWhen: 'routes.json lists every route with its sources and identities, and each pending route has its own inventory charter.' };
    case 'inventory': return { reference: 'references/interactions.md', doneWhen: 'The route is inventoried with no pending interaction, or marked unreachable/excluded with a reason.' };
    case 'intent': return { reference: 'references/functionality.md', doneWhen: 'Each subject capability has a goal and rules the user settled, or an excluded disposition with a reason.' };
    case 'scenarios': return {
      reference: charter.tier === 'adversarial' ? 'references/adversarial.md' : charter.tier === 'error' ? 'references/error-paths.md' : 'references/functionality.md',
      doneWhen: `Each subject capability has ${charter.tier ?? 'happy'}-tier scenarios and the user confirmed the displayed scope (qa.ts approve-batch).`,
    };
    case 'run': return { reference: 'references/execution.md', doneWhen: 'The build is observed, every scenario in the run has a recorded disposition, and the report is rendered.' };
    case 'lock': return { reference: 'references/lock-and-report.md', doneWhen: 'The user confirmed the contract and locked.json matches the current suite.' };
    case 'task': return { reference: 'the charter mission', doneWhen: 'The mission is done and the gist records the facts later charters depend on.' };
  }
}

function validate(chart: Chart): Chart {
  assert.ok(chart.version === 1 && Array.isArray(chart.charters), 'Unknown charters.json format; preserve it and reconcile before continuing.');
  for (const key of ['notes', 'fog', 'outOfScope'] as const) {
    assert.ok(Array.isArray(chart[key]) && chart[key].every(line => typeof line === 'string'), `charters.json ${key} must be a list of lines.`);
  }
  assert.equal(typeof chart.destination, 'string', 'charters.json needs a destination (empty until it is named).');
  const byId = new Map<string, Charter>();
  for (const charter of chart.charters) {
    assert.ok(!byId.has(safeId(charter.id)), `Duplicate charter ID ${charter.id}.`);
    byId.set(charter.id, charter);
    assert.ok(charter.name?.trim() && charter.mission?.trim(), `${charter.id} needs a name and a mission.`);
    assert.ok(kinds.includes(charter.kind) && ['HITL', 'AFK'].includes(charter.mode), `${charter.id} has an unknown kind or mode.`);
    assert.ok(['open', 'closed', 'out-of-scope'].includes(charter.status), `${charter.id} has an unknown status.`);
    assert.ok(Array.isArray(charter.blockedBy), `${charter.id} needs a blockedBy list.`);
    assert.ok(charter.status === 'open' || charter.gist?.trim(), `${charter.id} is ${charter.status}: record its one-line gist.`);
    assert.ok(charter.status === 'open' ? charter.claimedBy === null || Boolean(charter.claimedBy.trim()) : true, `${charter.id} has an invalid claim.`);
    if (['inventory', 'intent', 'scenarios', 'run'].includes(charter.kind)) {
      assert.ok(Array.isArray(charter.subjects) && charter.subjects.length > 0, `${charter.id} needs subjects: the route, capability paths or run it is about.`);
    }
  }
  const visit = (id: string, trail: string[]): void => {
    assert.ok(!trail.includes(id), `Charters block each other in a cycle: ${[...trail, id].join(' → ')}.`);
    for (const blocker of byId.get(id)!.blockedBy) {
      assert.ok(byId.has(blocker), `${id} is blocked by an unknown charter ${blocker}.`);
      visit(blocker, [...trail, id]);
    }
  };
  for (const id of byId.keys()) {
    visit(id, []);
  }
  return chart;
}

export function loadChart(root: string): Chart {
  const file = join(root, 'charters.json');
  assert.ok(existsSync(file), 'This workspace has no map yet. Run: qa.ts chart <qa-root>, then read references/wayfinding.md (Adopting an existing workspace).');
  return validate(readJson<Chart>(file));
}

export function saveChart(root: string, chart: Chart): void {
  writeJson(join(root, 'charters.json'), validate(chart));
}

/** Chart the opening of a QA effort. Later charters graduate out of the fog as these close. */
export function seedChart(root: string): Chart {
  assert.ok(!existsSync(join(root, 'charters.json')), 'The map already exists; work through it instead of charting again.');
  for (const directory of ['interactions', 'barriers']) {
    mkdirSync(join(root, directory), { recursive: true });
  }
  if (!existsSync(join(root, 'routes.json'))) {
    writeJson(join(root, 'routes.json'), { version: 1, routes: [] });
  }
  const open = { status: 'open', claimedBy: null, gist: '' } as const;
  const chart: Chart = {
    version: 1, destination: '', notes: [],
    fog: [
      'Which capabilities the routes add up to, and what each one is for (after the route inventories).',
      'Happy-path scenarios for each capability (after its intent is settled).',
      'The happy run under scrutiny and the baseline lock.',
      'Error paths for each capability (after the baseline is locked).',
      'Adversarial scenarios for each capability (after the baseline is locked).',
    ],
    outOfScope: [],
    charters: [
      { id: 'setup', name: 'Set up the QA effort', kind: 'setup', mode: 'HITL', mission: 'Name the destination with the user and confirm environments, identities, issue storage, coverage and the mutation policy.', blockedBy: [], ...open },
      { id: 'find-routes', name: 'Find every route', kind: 'routes', mode: 'AFK', mission: 'List every route of the app from its source and a crawl per identity, then charter one inventory per route.', blockedBy: ['setup'], ...open },
    ],
  };
  saveChart(root, chart);
  return chart;
}

function cleared(chart: Chart, charter: Charter): boolean {
  return charter.blockedBy.every(id => chart.charters.find(item => item.id === id)!.status !== 'open');
}

/** The frontier: open, unblocked, unclaimed charters, in charted order. */
export function frontier(chart: Chart): Charter[] {
  return chart.charters.filter(charter => charter.status === 'open' && charter.claimedBy === null && cleared(chart, charter));
}

function find(chart: Chart, id: string): Charter {
  const charter = chart.charters.find(item => item.id === id);
  assert.ok(charter, `Unknown charter ${id}. Run qa.ts map <qa-root> for the frontier.`);
  return charter;
}

function brief(charter: Charter): string {
  const { reference, doneWhen } = guide(charter);
  return [
    `In hand: ${charter.name} (${charter.id}, ${charter.mode})`,
    `Mission: ${charter.mission}`,
    ...(charter.subjects?.length ? [`Subjects: ${charter.subjects.join(', ')}`] : []),
    `Read: ${reference}`,
    `Done when: ${doneWhen}`,
    'Park anything else you notice as a new charter or a fog line; then return to this charter.',
  ].join('\n');
}

/** One claimant holds one charter at a time; the claim is what keeps parallel workers off it. */
export function claim(root: string, id: string, who: string): string {
  const chart = loadChart(root);
  const charter = find(chart, id);
  assert.ok(who.trim(), 'Name the claimant: parent, or a worker lane ID.');
  assert.equal(charter.status, 'open', `${charter.name} is already ${charter.status}.`);
  if (charter.claimedBy === who) {
    return brief(charter);
  }
  assert.equal(charter.claimedBy, null, `${charter.name} is claimed by ${charter.claimedBy}.`);
  const waiting = charter.blockedBy.map(blocker => find(chart, blocker)).filter(blocker => blocker.status === 'open').map(blocker => blocker.name);
  assert.equal(waiting.length, 0, `${charter.name} waits on: ${waiting.join(', ')}.`);
  const held = chart.charters.find(item => item.status === 'open' && item.claimedBy === who);
  assert.ok(!held, `${who} already holds ${held?.name} (${held?.id}). Close or release it before taking another charter.`);
  charter.claimedBy = who;
  saveChart(root, chart);
  return brief(charter);
}

/** Hand a charter back to the frontier, usually after charting the blocker that stopped it. */
export function release(root: string, id: string): string {
  const chart = loadChart(root);
  const charter = find(chart, id);
  assert.equal(charter.status, 'open', `${charter.name} is already ${charter.status}.`);
  charter.claimedBy = null;
  saveChart(root, chart);
  return `Released ${charter.name}.`;
}

/** Rule a charter beyond the destination. It leaves the frontier for good and unblocks nothing it promised. */
export function ruleOut(root: string, id: string, reason: string): string {
  const chart = loadChart(root);
  const charter = find(chart, id);
  assert.equal(charter.status, 'open', `${charter.name} is already ${charter.status}.`);
  assert.ok(reason.trim(), 'Record why this sits beyond the destination.');
  charter.status = 'out-of-scope';
  charter.claimedBy = null;
  charter.gist = reason.trim();
  saveChart(root, chart);
  return `Ruled out of scope: ${charter.name}.`;
}

function capped(lines: string[], all: boolean, empty: string): string[] {
  if (lines.length === 0) {
    return [empty];
  }
  const limit = all ? lines.length : 8;
  return lines.length > limit ? [...lines.slice(0, limit), `- …and ${lines.length - limit} more (qa.ts map <qa-root> all).`] : lines;
}

/** The whole effort at low resolution. Regenerated from disk, so it survives any loss of conversation context. */
export function renderMap(root: string, all = false): string {
  const chart = loadChart(root);
  const name = (id: string): string => find(chart, id).name;
  const open = chart.charters.filter(charter => charter.status === 'open');
  const inHand = open.filter(charter => charter.claimedBy !== null);
  const takeable = frontier(chart);
  const blocked = open.filter(charter => charter.claimedBy === null && !cleared(chart, charter));
  const lockFile = join(root, 'locked.json');
  const lock = existsSync(lockFile) ? readJson<Lock>(lockFile) : undefined;
  const tiers = lock?.tiers ? Object.entries(lock.tiers).filter(([, count]) => count > 0).map(([tier, count]) => `${count} ${tier}`).join(', ') : 'tiers not recorded';
  const barriers = barrierIds(root);
  const next = inHand[0] ?? takeable[0];
  const text = [
    '# QA map', '',
    '## Destination', '', chart.destination.trim() || 'Not named yet. Naming it is the first act of the setup charter.', '',
    `Locked so far: ${lock ? `${tiers} (source run ${lock.sourceRun})` : 'nothing'}.`, '',
    ...(chart.notes.length ? ['## Notes', '', ...chart.notes.map(line => `- ${line}`), ''] : []),
    '## In hand', '', ...capped(inHand.map(charter => `- **${charter.name}** (\`${charter.id}\`, ${charter.mode}, held by ${charter.claimedBy})`), all, 'Nothing claimed.'), '',
    '## Frontier', '', ...capped(takeable.map(charter => `- **${charter.name}** (\`${charter.id}\`, ${charter.mode}): ${charter.mission}`), all, 'Empty.'), '',
    '## Blocked', '', ...capped(blocked.map(charter => `- **${charter.name}** waits on ${charter.blockedBy.filter(id => find(chart, id).status === 'open').map(name).join(', ')}`), all, 'Nothing blocked.'), '',
    '## Done so far', '', ...capped(chart.charters.filter(charter => charter.status === 'closed').map(charter => `- **${charter.name}**: ${charter.gist}`), all, 'Nothing closed yet.'), '',
    '## Fog', '', ...capped(chart.fog.map(line => `- ${line}`), true, 'No fog: everything toward the destination is chartered.'), '',
    '## Out of scope', '', ...capped([...chart.charters.filter(charter => charter.status === 'out-of-scope').map(charter => `- **${charter.name}**: ${charter.gist}`), ...chart.outOfScope.map(line => `- ${line}`)], all, 'Nothing ruled out.'), '',
    '## Barriers', '', barriers.length ? `${barriers.length} noted in barriers/: ${barriers.join(', ')}.` : 'None noted.', '',
    '## Next', '', next
      ? `${inHand[0] ? 'Finish' : 'Claim'} **${next.name}** (\`${next.id}\`).`
      : open.length ? 'Every open charter is blocked: chart what unblocks them, or ask the user.'
        : chart.fog.length ? 'No open charters, but fog remains: graduate what is now specifiable into charters.'
          : 'No open charters and no fog: the destination is reached. Report to the user.',
    '',
  ].join('\n');
  writeFileSync(join(root, 'map.md'), text, 'utf8');
  return text;
}
