import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { test } from 'vitest'

const signer = path.join(path.dirname(fileURLToPath(import.meta.url)), 'sign-ci-key-possession-challenge.mjs')
const canonical = (value) => Array.isArray(value)
  ? value.map(canonical)
  : value && typeof value === 'object'
    ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]))
    : value
const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex')
function fixture(overrides = {}) {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('ed25519')
  const publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' }).toString()
  return {
    privateKey, publicKeyPem,
    env: {
      ...process.env,
      RISK_V2_ED25519_PRIVATE_KEY_PKCS8_BASE64: privateKey.export({ type: 'pkcs8', format: 'der' }).toString('base64'),
      PUBLIC_KEY_SHA256: sha256(Buffer.from(publicKeyPem)),
      CHALLENGE_SHA256: 'a'.repeat(64),
      ENROLLMENT_ID: 'c'.repeat(64),
      EXECUTION_PLAN_SHA256: 'd'.repeat(64),
      SOURCE_REF: 'refs/heads/evidence/risk-v2-w2-09-test',
      SOURCE_SHA: 'b'.repeat(40),
      GITHUB_WORKFLOW_REF: 'auroraverse-ops/aurora-check-in/.github/workflows/risk-v2-ci-key-challenge.yml@refs/heads/main',
      GITHUB_WORKFLOW_SHA: 'e'.repeat(40),
      GITHUB_REPOSITORY_ID: '987654321',
      GITHUB_RUN_ID: '123456789',
      GITHUB_RUN_ATTEMPT: '1',
      GITHUB_ACTOR_ID: '42424242',
      GITHUB_TRIGGERING_ACTOR: 'trusted-release-operator',
      GITHUB_REF: 'refs/heads/main',
      GITHUB_SHA: 'e'.repeat(40),
      GITHUB_REPOSITORY: 'auroraverse-ops/aurora-check-in',
      ...overrides,
    },
  }
}

test('interoperates with the canonical repository-bound Ed25519 statement', () => {
  const sample = fixture()
  const result = spawnSync(process.execPath, [signer], { env: sample.env, encoding: 'utf8' })
  assert.equal(result.status, 0, result.stderr)
  const payload = JSON.parse(result.stdout)
  assert.deepEqual(Object.keys(payload.statement), [
    'schema', 'schema_version', 'role', 'repository', 'environment', 'key_id',
    'public_key_sha256', 'challenge', 'enrollment_id', 'execution_plan_sha256',
    'source_ref', 'source_sha', 'workflow_ref', 'workflow_sha', 'repository_id',
    'run_id', 'run_attempt', 'actor_id', 'triggering_actor', 'statement_sha256',
  ])
  assert.deepEqual({ role: payload.statement.role, repository: payload.statement.repository,
    environment: payload.statement.environment, key_id: payload.statement.key_id },
  { role: 'checkin_ci', repository: 'auroraverse-ops/aurora-check-in',
    environment: 'repository-secret-pinned-main-workflow', key_id: 'KEY-CHECKIN-CI-EVIDENCE-01' })
  const statement = Object.fromEntries(Object.entries(payload.statement).filter(([key]) => key !== 'statement_sha256'))
  assert.equal(payload.statement.statement_sha256, sha256(JSON.stringify(canonical(statement))))
  assert.deepEqual(Object.keys(payload.response), ['statement_sha256', 'signature_base64'])
  assert.equal(payload.response.statement_sha256, payload.statement.statement_sha256)
  assert.equal(crypto.verify(
    null,
    Buffer.from(payload.statement.statement_sha256, 'hex'),
    sample.publicKeyPem,
    Buffer.from(payload.response.signature_base64, 'base64'),
  ), true)
})

test('fails closed for mutable-workflow or mismatched source contexts', () => {
  for (const overrides of [
    { GITHUB_REPOSITORY: 'owner/not-the-bound-repository' },
    { SOURCE_REF: 'refs/heads/main' },
    { ENROLLMENT_ID: 'f'.repeat(63) },
    { EXECUTION_PLAN_SHA256: 'F'.repeat(64) },
    { GITHUB_REF: 'refs/heads/evidence/not-main' },
    { GITHUB_SHA: 'f'.repeat(40) },
    { GITHUB_WORKFLOW_SHA: 'f'.repeat(39) },
    { GITHUB_REPOSITORY_ID: '0' },
    { GITHUB_RUN_ATTEMPT: '0' },
    { GITHUB_ACTOR_ID: '0' },
    { GITHUB_TRIGGERING_ACTOR: 'invalid actor' },
    { GITHUB_WORKFLOW_REF: 'auroraverse-ops/aurora-check-in/.github/workflows/risk-v2-ci-key-challenge.yml@refs/heads/evidence/not-main' },
  ]) {
    const sample = fixture(overrides)
    const result = spawnSync(process.execPath, [signer], { env: sample.env, encoding: 'utf8' })
    assert.notEqual(result.status, 0)
    assert.equal(result.stdout, '')
    assert.match(result.stderr, /^FAIL ci key possession challenge:/)
  }
})
