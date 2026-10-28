import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseEnv } from 'node:util';
import { pathToFileURL } from 'node:url';
import type { Writable } from 'node:stream';
import { join } from 'node:path';
import { readJson } from './workspace.ts';
import type { Config } from './models.ts';
import assert from 'node:assert/strict';

/** Expose key names and presence only; never return the loaded credential values. */
export function missingCredentialKeys(root: string): string[] {
  const config = readJson<Config>(join(root, 'config.json'));
  const values = parseEnv(readFileSync(join(root, '.env.qa'), 'utf8'));
  const keys = [...new Set(config.identities.flatMap(identity => identity.envKeys))];
  assert.ok(keys.every(key => /^[A-Z_][A-Z0-9_]*$/.test(key)), 'Credential references must be env key names.');
  return keys.filter(key => !values[key]?.trim());
}

/** Redact literal secret values even when child-process output splits them across chunks. */
export function redactor(secrets: string[], output: Writable): { push: (chunk: string) => void; end: () => void } {
  const values = [...new Set(secrets.filter(Boolean))].sort((a, b) => b.length - a.length);
  const longest = Math.max(1, ...values.map(value => value.length));
  let pending = '';
  function flush(final: boolean): void {
    let index = 0;
    let safe = '';
    while (index < pending.length && (final || index <= pending.length - longest)) {
      const match = values.find(value => pending.startsWith(value, index));
      if (match) {
        safe += '[REDACTED]';
        index += match.length;
      } else {
        safe += pending[index];
        index += 1;
      }
    }
    pending = pending.slice(index);
    if (safe) {
      output.write(safe);
    }
  }
  return { push(chunk) { pending += chunk; flush(false); }, end() { flush(true); } };
}

/** Only the local process reads .env.qa; stdout/stderr expose no literal values from that file. */
export async function runWithQaEnv(envPath: string, runner: string, args: string[]): Promise<number> {
  const values = parseEnv(readFileSync(envPath, 'utf8'));
  const child = spawn(process.execPath, [resolve(runner), ...args], {
    env: { ...process.env, ...values }, stdio: ['inherit', 'pipe', 'pipe'], shell: false,
  });
  const secrets = Object.values(values).filter((value): value is string => typeof value === 'string');
  const out = redactor(secrets, process.stdout);
  const err = redactor(secrets, process.stderr);
  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');
  child.stdout.on('data', (chunk: string) => out.push(chunk));
  child.stderr.on('data', (chunk: string) => err.push(chunk));
  return await new Promise<number>((done, reject) => {
    child.once('error', reject);
    child.once('close', code => { out.end(); err.end(); done(code ?? 1); });
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [envPath, runner, ...args] = process.argv.slice(2);
  if (!envPath || !runner) {
    console.error('Usage: node with-qa-env.ts <.env.qa-path> <trusted-runner.ts> [args]');
    process.exitCode = 1;
  } else {
    try {
      process.exitCode = await runWithQaEnv(envPath, runner, args);
    } catch {
      console.error('QA runner could not start. Check the local env file and runner path; no credential contents were printed.');
      process.exitCode = 1;
    }
  }
}
