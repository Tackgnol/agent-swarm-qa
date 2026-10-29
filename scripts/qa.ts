import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { approve, approveBatch, focusReviewPath, initialize, loadSuite, lockSuite, nextPathId, reviewPath, startRun } from './workspace.ts';
import { writePlanningReport, writeReport } from './report.ts';
import type { Run } from './models.ts';
import { missingCredentialKeys, preparePrivateEnv } from './with-qa-env.ts';
import { join } from 'node:path';
import { writeFileSync } from 'node:fs';
import { readJson, requiredEnvKeys } from './workspace.ts';
import type { Config } from './models.ts';
import { exportGherkin } from './to-gherkin.ts';

export function main(args: string[]): string {
  const [command, root, first, second, third] = args;
  if (!root) {
    throw new Error('Usage: qa.ts init <project-root> <slug> | approve <qa-root> <setup|path:ID|scenario-ID> <decision-ref> | approve-batch <qa-root> <decision-ref> <path-ID...> | run <qa-root> <environment> <run-id> <first-run|retest> | lock <qa-root> <run-id> <decision-ref> | report <qa-root> [run-id] | check <qa-root>');
  }
  switch (command) {
    case 'init': {
      if (!first) { throw new Error('A project slug is required.'); }
      const path = initialize(root, first);
      writePlanningReport(path);
      return `QA workspace: ${path}\nPrivate .env.qa created with no credentials. Fill it locally, never in chat. The agent must never open/print it; only trusted runner processes load it.`;
    }
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
    default: throw new Error('Unknown QA command.');
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
