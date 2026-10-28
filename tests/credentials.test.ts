import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { writeFileSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { Writable } from 'node:stream';
import { redactor, missingCredentialKeys, preparePrivateEnv } from '../scripts/with-qa-env.ts';
import { fixture, repo } from './helpers.ts';
import { readJson, writeJson } from '../scripts/workspace.ts';
import { main } from '../scripts/qa.ts';
import type { Config } from '../scripts/models.ts';

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

test('private URL and numbered account slots are prepared without changing existing values', () => {
  const f = fixture();
  try {
    const config = readJson<Config>(join(f.root, 'config.json'));
    config.environments[0].hostUrlEnv = 'OWLBEAR_URL';
    config.privateEnvKeys = ['OWLBEAR_LOGIN_METHOD'];
    config.identities.push({ alias: 'host-owner', kind: 'authenticated', role: 'host owner', envKeys: ['OWLBREAR_LOGIN_1', 'OWLBREAR_PASS_1'] });
    config.identities.push({ alias: 'host-member', kind: 'authenticated', role: 'host member', envKeys: ['OWLBREAR_LOGIN_2', 'OWLBREAR_PASS_2'] });
    writeJson(join(f.root, 'config.json'), config);
    const original = '# Preserve this comment and existing synthetic values\nQA_OWNER_PASSWORD="synthetic-kept"\nOWLBEAR_URL="https://host.example.test/private/synthetic-room"';
    writeFileSync(join(f.root, '.env.qa'), original);
    const prepared = preparePrivateEnv(f.root);
    assert.ok(prepared.addedKeys.includes('OWLBREAR_LOGIN_1'));
    assert.ok(prepared.addedKeys.includes('OWLBREAR_PASS_2'));
    assert.ok(prepared.addedKeys.includes('OWLBEAR_LOGIN_METHOD'));
    assert.ok(!prepared.addedKeys.includes('OWLBEAR_URL'));
    assert.ok(!JSON.stringify(prepared).includes('synthetic-kept'));
    const after = readFileSync(join(f.root, '.env.qa'), 'utf8');
    assert.ok(after.startsWith(original));
    assert.equal(after.split('QA_OWNER_PASSWORD=').length - 1, 1);
    assert.deepEqual(preparePrivateEnv(f.root), { addedKeys: [] });
    assert.equal(readFileSync(join(f.root, '.env.qa'), 'utf8'), after);
    assert.ok(missingCredentialKeys(f.root).includes('OWLBREAR_PASS_2'));
    assert.ok(!missingCredentialKeys(f.root).includes('OWLBEAR_URL'));
    main(['env-template', f.root]);
    const template = readFileSync(join(f.root, '.env.qa.example'), 'utf8');
    assert.ok(template.includes('OWLBEAR_URL=\n'));
    assert.ok(template.includes('OWLBREAR_LOGIN_2=\n'));
    assert.ok(!template.includes('synthetic-room'));
    assert.equal(readFileSync(join(f.root, '.env.qa'), 'utf8'), after);
  } finally { rmSync(f.project, { recursive: true, force: true }); }
});
