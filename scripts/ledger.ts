import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { readJson, writeJson } from './store.ts';
import { withChartLock } from './wayfinding.ts';

export type WriteLedger = {
  version: 1;
  /** The most test-owned writes the user agreed to for this effort, and what one write is ("draft"). */
  limit: number | null; unit: string;
  writes: { at: string; who: string; what: string }[];
  /** Test data that exists on the target: who made it and whether it was cleaned up. */
  fixtures: { id: string; owner: string; cleanup: 'pending' | 'done' | 'handed-off'; note: string }[];
};

export function loadLedger(root: string): WriteLedger {
  const file = join(root, 'writes.json');
  return existsSync(file) ? readJson<WriteLedger>(file) : { version: 1, limit: null, unit: 'write', writes: [], fixtures: [] };
}

/** Set the write budget the user agreed to. Lowering it below what is already spent is refused. */
export function setBudget(root: string, limit: number, unit: string): string {
  return withChartLock(root, () => {
    const ledger = loadLedger(root);
    assert.ok(Number.isInteger(limit) && limit >= 0, 'The budget is a whole number of writes.');
    assert.ok(unit.trim(), 'Name what one write is, for example "draft".');
    assert.ok(limit >= ledger.writes.length, `${ledger.writes.length} writes are already recorded; the budget cannot be set below that.`);
    ledger.limit = limit;
    ledger.unit = unit.trim();
    writeJson(join(root, 'writes.json'), ledger);
    return budgetLine(ledger);
  });
}

export function budgetLine(ledger: WriteLedger): string {
  const left = ledger.fixtures.filter(fixture => fixture.cleanup !== 'done').length;
  const budget = ledger.limit === null ? `${ledger.writes.length} writes recorded, no budget set` : `${ledger.writes.length} of ${ledger.limit} ${ledger.unit} writes spent`;
  return `${budget}; ${left} test fixtures left on the target.`;
}

/** Record one write BEFORE making it. Refuses when the budget is spent, so a lane stops instead of overshooting. */
export function spend(root: string, who: string, what: string): string {
  return withChartLock(root, () => {
    const ledger = loadLedger(root);
    assert.ok(who.trim() && what.trim(), 'Say who is writing and what the write is.');
    assert.ok(ledger.limit !== null, 'No write budget is set. The parent sets it with: qa.ts budget <qa-root> <limit> <unit>.');
    assert.ok(ledger.writes.length < ledger.limit, `Write budget exhausted (${ledger.limit} ${ledger.unit}). Stop, make no further writes, and report to the parent.`);
    ledger.writes.push({ at: new Date().toISOString(), who: who.trim(), what: what.trim() });
    writeJson(join(root, 'writes.json'), ledger);
    return `Write ${ledger.writes.length} of ${ledger.limit} recorded for ${who.trim()}.`;
  });
}

/** Note test data left on the target, in any phase, so cleanup debt has one home. */
export function recordFixture(root: string, id: string, owner: string, note: string, cleanup: WriteLedger['fixtures'][number]['cleanup'] = 'pending'): string {
  return withChartLock(root, () => {
    const ledger = loadLedger(root);
    assert.ok(id.trim() && owner.trim() && note.trim(), 'A fixture needs an ID (or a description when the ID is unknown), an owner and a note.');
    assert.ok(['pending', 'done', 'handed-off'].includes(cleanup), 'Cleanup is pending, done or handed-off.');
    const existing = ledger.fixtures.find(fixture => fixture.id === id.trim());
    if (existing) {
      Object.assign(existing, { owner: owner.trim(), note: note.trim(), cleanup });
    } else {
      ledger.fixtures.push({ id: id.trim(), owner: owner.trim(), cleanup, note: note.trim() });
    }
    writeJson(join(root, 'writes.json'), ledger);
    return budgetLine(ledger);
  });
}
