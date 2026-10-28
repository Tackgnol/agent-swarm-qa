import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { Writable } from 'node:stream';
import { redactor, missingCredentialKeys } from '../scripts/with-qa-env.ts';
import { fixture, repo } from './helpers.ts';

test('redaction covers split chunks, prefixes and both final/output paths', () => {
  let output = '';
  const sink = new Writable({ write(chunk, _encoding, done) { output += chunk.toString(); done(); } });
  const mask = redactor(['synthetic-secret', 'synthetic-secret-long', ''], sink);
  for (const part of ['before synthetic-', 'secret-long and synthetic-s', 'ecret after']) { mask.push(part); }
  mask.end();
  assert.equal(output, 'before [REDACTED] and [REDACTED] after');
});

test('trusted child receives env values without shell expansion and logs are redacted', () => {
  const f = fixture();
  try {
    const env = join(f.root, '.env.qa');
    writeFileSync(env, 'QA_OWNER_PASSWORD="synthetic-$(never-execute)-secret"\n');
    const runner = join(f.root, 'runners', 'offline.ts');
    writeFileSync(runner, 'if (process.env.QA_OWNER_PASSWORD !== "synthetic-$(never-execute)-secret") { process.exit(4); } process.stdout.write(process.env.QA_OWNER_PASSWORD); process.stderr.write(process.env.QA_OWNER_PASSWORD); process.exitCode = 3;');
    const result = spawnSync(process.execPath, [join(repo, 'scripts', 'with-qa-env.ts'), env, runner], { encoding: 'utf8' });
    assert.equal(result.status, 3);
    assert.equal(result.stdout, '[REDACTED]');
    assert.equal(result.stderr, '[REDACTED]');
    assert.deepEqual(missingCredentialKeys(f.root), ['QA_OWNER_USERNAME', 'QA_MEMBER_USERNAME', 'QA_MEMBER_PASSWORD']);
  } finally { rmSync(f.project, { recursive: true, force: true }); }
});
