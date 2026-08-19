#!/usr/bin/env node
import crypto from 'node:crypto'

const ROLE = 'checkin_ci'
const REPOSITORY = 'auroraverse-ops/aurora-check-in'
const KEY_ID = 'KEY-CHECKIN-CI-EVIDENCE-01'
const ENVIRONMENT = 'risk-v2-evidence'
const SECRET_NAME = 'RISK_V2_ED25519_PRIVATE_KEY_PKCS8_BASE64'
const WORKFLOW_REF = `${REPOSITORY}/.github/workflows/risk-v2-ci-key-challenge.yml@refs/heads/main`
const HEX_64 = /^[a-f0-9]{64}$/
const HEX_40 = /^[a-f0-9]{40}$/
const POSITIVE_ID = /^[1-9][0-9]{0,19}$/
const ACTOR_LOGIN = /^[A-Za-z0-9-]{1,39}$/
const EVIDENCE_REF = /^refs\/heads\/evidence\/[A-Za-z0-9](?:[A-Za-z0-9._/-]{0,198}[A-Za-z0-9])?$/
const BASE64 = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/

const canonical = (value) => Array.isArray(value)
  ? value.map(canonical)
  : value && typeof value === 'object'
    ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]))
    : value
const canonicalJson = (value) => JSON.stringify(canonical(value))
const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex')

const privateKeyBase64 = process.env[SECRET_NAME]
delete process.env[SECRET_NAME]

try {
  const publicKeySha256 = process.env.PUBLIC_KEY_SHA256
  const challenge = process.env.CHALLENGE_SHA256
  const enrollmentId = process.env.ENROLLMENT_ID
  const executionPlanSha256 = process.env.EXECUTION_PLAN_SHA256
  const sourceRef = process.env.SOURCE_REF
  const sourceSha = process.env.SOURCE_SHA
  const workflowRef = process.env.GITHUB_WORKFLOW_REF
  const workflowSha = process.env.GITHUB_WORKFLOW_SHA
  const repositoryId = process.env.GITHUB_REPOSITORY_ID
  const runId = process.env.GITHUB_RUN_ID
  const runAttempt = process.env.GITHUB_RUN_ATTEMPT
  const actorId = process.env.GITHUB_ACTOR_ID
  const triggeringActor = process.env.GITHUB_TRIGGERING_ACTOR
  if (process.argv.length !== 2 || process.env.GITHUB_REPOSITORY !== REPOSITORY
    || !HEX_64.test(publicKeySha256 ?? '') || !HEX_64.test(challenge ?? '')
    || !HEX_64.test(enrollmentId ?? '') || !HEX_64.test(executionPlanSha256 ?? '')
    || !EVIDENCE_REF.test(sourceRef ?? '') || sourceRef.includes('..') || sourceRef.includes('//')
    || !HEX_40.test(sourceSha ?? '') || workflowRef !== WORKFLOW_REF || !HEX_40.test(workflowSha ?? '')
    || process.env.GITHUB_REF !== 'refs/heads/main' || process.env.GITHUB_SHA !== workflowSha
    || !POSITIVE_ID.test(repositoryId ?? '') || !POSITIVE_ID.test(runId ?? '') || !POSITIVE_ID.test(runAttempt ?? '')
    || !POSITIVE_ID.test(actorId ?? '') || !ACTOR_LOGIN.test(triggeringActor ?? '')
    || !BASE64.test(privateKeyBase64 ?? '')) throw new Error('ci_challenge_input_invalid')

  const privateKeyBytes = Buffer.from(privateKeyBase64, 'base64')
  try {
    const privateKey = crypto.createPrivateKey({ key: privateKeyBytes, format: 'der', type: 'pkcs8' })
    if (privateKey.asymmetricKeyType !== 'ed25519') throw new Error('ci_private_key_not_ed25519')
    const publicKeyPem = crypto.createPublicKey(privateKey).export({ type: 'spki', format: 'pem' }).toString()
    if (sha256(Buffer.from(publicKeyPem)) !== publicKeySha256) throw new Error('ci_private_key_digest_mismatch')
    const statement = {
      schema: 'aurora-risk-v2-ci-key-possession-challenge', schema_version: 1, role: ROLE,
      repository: REPOSITORY, environment: ENVIRONMENT, key_id: KEY_ID,
      public_key_sha256: publicKeySha256, challenge, enrollment_id: enrollmentId,
      execution_plan_sha256: executionPlanSha256, source_ref: sourceRef, source_sha: sourceSha,
      workflow_ref: workflowRef, workflow_sha: workflowSha, repository_id: repositoryId,
      run_id: runId, run_attempt: runAttempt, actor_id: actorId, triggering_actor: triggeringActor,
    }
    const statementSha256 = sha256(canonicalJson(statement))
    const response = {
      statement_sha256: statementSha256,
      signature_base64: crypto.sign(null, Buffer.from(statementSha256, 'hex'), privateKey).toString('base64'),
    }
    process.stdout.write(`${JSON.stringify({ statement: { ...statement, statement_sha256: statementSha256 }, response })}\n`)
  } finally {
    privateKeyBytes.fill(0)
  }
} catch (error) {
  process.stderr.write(`FAIL ci key possession challenge: ${error.message}\n`)
  process.exitCode = 1
}
