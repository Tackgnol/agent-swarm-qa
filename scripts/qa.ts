import { writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { closeCharter } from './closing.ts';
import { interactionSummary } from './interactions.ts';
import { writePlanningReport, writeReport } from './report.ts';
import { exportGherkin } from './to-gherkin.ts';
import { claim, release, renderMap, ruleOut, seedChart } from './wayfinding.ts';
import { missingCredentialKeys, preparePrivateEnv } from './with-qa-env.ts';
import { approve, approveBatch, focusReviewPath, initialize, loadSuite, lockSuite, nextPathId, readJson, requiredEnvKeys, reviewPath, startRun } from './workspace.ts';
import type { Config, Run } from './models.ts';

const usage = `Usage: qa.ts <command> <qa-root> ...
  Map:      map <qa-root> [all] | claim <qa-root> <charter> [claimant] | close <qa-root> <charter> <gist> | release <qa-root> <charter> | rule-out <qa-root> <charter> <reason> | chart <qa-root>
  Setup:    init <project-root> <slug> | prepare-env | env-template | check-env <qa-root>
  Learn:    interactions <qa-root> | next-path | next-path-id | focus-path <qa-root> <path-ID> <decision-ref> <reason>
  Approve:  approve <qa-root> <setup|path:ID|scenario-ID> <decision-ref> | approve-batch <qa-root> <decision-ref> <path-ID...> | check <qa-root>
  Run:      run <qa-root> <environment> <run-id> <first-run|retest> | report <qa-root> [run-id] | lock <qa-root> <run-id> <decision-ref>
  Export:   to-gherkin <qa-root> <export-id>`;

export function main(args: string[]): string {
  const [command, root, first, second, third] = args;
  if (!root) {
    throw new Error(usage);
  }
  switch (command) {
    case 'init': {
      if (!first) { throw new Error('A project slug is required.'); }
      const path = initialize(root, first);
      writePlanningReport(path);
      return `QA workspace: ${path}\nPrivate .env.qa created with no credentials. Fill it locally, never in chat. The agent must never open/print it; only trusted runner processes load it.\nThe map is charted: run qa.ts map ${path}`;
    }
    case 'map': return renderMap(root, first === 'all');
    case 'chart': {
      seedChart(root);
      return renderMap(root);
    }
    case 'claim': {
      if (!first) { throw new Error('Name the charter to claim.'); }
      return claim(root, first, second ?? 'parent');
    }
    case 'close': {
      if (!first || !second) { throw new Error('A charter and a one-line gist of its outcome are required.'); }
      return closeCharter(root, first, second);
    }
    case 'release': {
      if (!first) { throw new Error('Name the charter to release.'); }
      return release(root, first);
    }
    case 'rule-out': {
      if (!first || !second) { throw new Error('A charter and the reason it sits beyond the destination are required.'); }
      return ruleOut(root, first, second);
    }
    case 'interactions': return interactionSummary(root);
    case 'approve': {
      if (!first || !second) { throw new Error('Subject and actual user decision reference are required.'); }
      approve(root, first, second);
      return 'Recorded user approval for the current content fingerprint.';
    }
    case 'approve-batch': {
      if (!first || !second) { throw new Error('An actual scope confirmation reference and displayed path IDs are required.'); }
      return JSON.stringify(approveBatch(root, first, args.slice(3)), null, 2);
    }
    case 'check': return `Approved suite: ${loadSuite(root).hash}`;
    case 'to-gherkin': {
      if (!first) { throw new Error('A unique export ID is required: to-gherkin <qa-root> <export-id>.'); }
      return exportGherkin(root, first);
    }
    case 'next-path': return JSON.stringify(reviewPath(root), null, 2);
    case 'next-path-id': return nextPathId(root);
    case 'focus-path': {
      if (!first || !second || !third) { throw new Error('Path ID, actual user decision reference and reason are required.'); }
      return JSON.stringify(focusReviewPath(root, first, second, third), null, 2);
    }
    case 'env-template': {
      const config = readJson<Config>(join(root, 'config.json'));
      const keys = requiredEnvKeys(config);
      const path = join(root, '.env.qa.example');
      writeFileSync(path, `# Copy these empty slots into .env.qa and fill them locally. Never paste values into chat.\n${keys.map(key => `${key}=`).join('\n')}\n`, 'utf8');
      return `${path}\nExisting .env.qa was not read or modified.`;
    }
    case 'check-env': {
      const missing = missingCredentialKeys(root);
      return missing.length ? `Missing private prerequisite key names: ${missing.join(', ')}` : 'Required private prerequisite keys are present. No values were returned.';
    }
    case 'prepare-env': {
      const { addedKeys } = preparePrivateEnv(root);
      return `Added empty private slots: ${addedKeys.join(', ') || '(none; existing slots preserved)'}. Fill .env.qa locally. No existing values were changed or returned.`;
    }
    case 'run': {
      if (!first || !second || !third) { throw new Error('Environment, unique run ID and phase are required.'); }
      return startRun(root, first, second, third as Run['phase']);
    }
    case 'lock': {
      if (!first || !second) { throw new Error('Run ID and actual lock-in decision reference are required.'); }
      lockSuite(root, first, second);
      return 'Locked the reviewed suite, preserving its actual result dispositions.';
    }
    case 'report': return first ? writeReport(root, first) : writePlanningReport(root);
    default: throw new Error(`Unknown QA command.\n${usage}`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    console.log(main(process.argv.slice(2)));
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'QA command failed.');
    process.exitCode = 1;
  }
}
