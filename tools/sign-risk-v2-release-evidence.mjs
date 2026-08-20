#!/usr/bin/env node
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const HEX64 = /^[a-f0-9]{64}$/
const HEX40 = /^[a-f0-9]{40}$/
const BASE64 = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/
const EVIDENCE_ID = /^EVD-[A-Z0-9][A-Z0-9-]{5,119}$/
const CLAIM_ID = /^RISK-[A-Z0-9][A-Z0-9-]{5,119}$/
const KEY_ID = /^KEY-[A-Z0-9][A-Z0-9-]{5,119}$/
const exact = (value, keys) => value && typeof value === 'object' && !Array.isArray(value)
  && Object.keys(value).length === keys.length && keys.every((key) => Object.prototype.hasOwnProperty.call(value, key))
const stable = (value) => Array.isArray(value) ? value.map(stable)
  : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])])) : value
const canonicalJson = (value) => JSON.stringify(stable(value))
const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex')
const canonicalUtc = (value) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)
  && new Date(value).toISOString() === value
const parseBase64Json = (encoded, label, maxEncodedLength = 60_000) => {
  if (typeof encoded !== 'string' || encoded.length < 4 || encoded.length > maxEncodedLength || !BASE64.test(encoded)) throw new Error(`${label}_base64_invalid`)
  const bytes = Buffer.from(encoded, 'base64')
  if (bytes.toString('base64') !== encoded) throw new Error(`${label}_base64_noncanonical`)
  let value
  try { value = JSON.parse(bytes.toString('utf8')) } catch { throw new Error(`${label}_json_invalid`) }
  if (!Buffer.from(JSON.stringify(value)).equals(bytes)) throw new Error(`${label}_json_noncanonical`)
  return value
}
const safeRelative = (value) => typeof value === 'string' && value.length > 10 && value.length <= 240
  && value.startsWith('docs/06-testing/evidence/risk-v2-baseline/release-evidence/')
  && !path.isAbsolute(value) && !value.split(/[\\/]/).includes('..') && !value.includes('\\')

const BODY = ['schema_version', 'evidence_id', 'claim_ids', 'evidence_type', 'outcome', 'repository', 'run', 'target', 'timing', 'release_binding', 'assertions', 'skips', 'cleanup', 'artifacts']
const REPOSITORY = ['name', 'ref', 'commit_sha', 'tree_sha', 'worktree_clean']
const RUN = ['run_id', 'runner_id', 'command_id', 'command_argv_sha256', 'exit_code']
const TARGET_BASE = ['environment', 'target_id', 'environment_fingerprint_sha256', 'write_mode']
const TIMING = ['started_at', 'finished_at']
const ASSERTION = ['assertion_id', 'result', 'artifact_sha256']
const ARTIFACT_BASE = ['path', 'sha256', 'size_bytes', 'kind']
const BUNDLE_ENTRY = ['path', 'bytes_base64']

export function computeRiskV2EvidenceStatementSha256(evidence) {
  const { attestation, ...body } = evidence
  return sha256(canonicalJson({ ...body, attestation: {
    kind: attestation.kind,
    subject: attestation.subject,
    authorization_ref: attestation.authorization_ref,
    key_id: attestation.key_id,
  } }))
}

function validateEvidence(evidence, bundle, context) {
  if (!exact(evidence, BODY) || evidence.schema_version !== 1 || !EVIDENCE_ID.test(evidence.evidence_id)
    || !Array.isArray(evidence.claim_ids) || evidence.claim_ids.length === 0 || new Set(evidence.claim_ids).size !== evidence.claim_ids.length
    || !evidence.claim_ids.every((entry) => CLAIM_ID.test(entry)) || !['positive', 'negative', 'operational', 'mutation'].includes(evidence.evidence_type)
    || evidence.outcome !== 'passed') throw new Error('evidence_identity_invalid')
  if (!exact(evidence.repository, REPOSITORY) || evidence.repository.name !== context.unit || evidence.repository.ref !== context.sourceRef
    || evidence.repository.commit_sha !== context.sourceSha || evidence.repository.tree_sha !== context.sourceTreeSha || evidence.repository.worktree_clean !== true) throw new Error('repository_binding_invalid')
  if (!exact(evidence.run, RUN) || typeof evidence.run.run_id !== 'string' || evidence.run.run_id.length < 3 || evidence.run.runner_id !== context.runnerId
    || typeof evidence.run.command_id !== 'string' || evidence.run.command_id.length < 3 || !HEX64.test(evidence.run.command_argv_sha256) || evidence.run.exit_code !== 0) throw new Error('run_binding_invalid')
  const targetKeys = [...TARGET_BASE, ...(Object.prototype.hasOwnProperty.call(evidence.target ?? {}, 'authorization_ref') ? ['authorization_ref'] : [])]
  if (!exact(evidence.target, targetKeys) || !['local', 'aurora-test'].includes(evidence.target.environment) || typeof evidence.target.target_id !== 'string'
    || evidence.target.target_id.length < 3 || !HEX64.test(evidence.target.environment_fingerprint_sha256) || evidence.target.write_mode !== 'none') throw new Error('target_binding_invalid')
  if (!exact(evidence.timing, TIMING) || !canonicalUtc(evidence.timing.started_at) || !canonicalUtc(evidence.timing.finished_at)
    || Date.parse(evidence.timing.finished_at) < Date.parse(evidence.timing.started_at) || Date.parse(evidence.timing.finished_at) > Date.now() + 5_000) throw new Error('timing_invalid')
  if (!evidence.release_binding || typeof evidence.release_binding !== 'object' || Array.isArray(evidence.release_binding)
    || evidence.release_binding.release_unit !== context.releaseUnit || evidence.release_binding.evidence_role !== context.evidenceRole
    || !HEX64.test(evidence.release_binding.release_context_sha256) || !HEX64.test(evidence.release_binding.impact_fingerprint_sha256)) throw new Error('release_binding_invalid')
  if (context.consumerUnit !== null && evidence.release_binding.consumer_unit !== context.consumerUnit) throw new Error('consumer_binding_invalid')
  if (context.consumerUnit === null && Object.prototype.hasOwnProperty.call(evidence.release_binding, 'consumer_unit')) throw new Error('consumer_binding_unexpected')
  if (['deployment', 'checkin_contract'].includes(context.evidenceRole) !== HEX64.test(evidence.release_binding.deployment_revision_sha256 ?? '')) throw new Error('deployment_binding_invalid')
  if (['build', 'consumer_build', 'checkin_contract'].includes(context.evidenceRole) !== safeRelative(evidence.release_binding.release_artifact_path ?? '')) throw new Error('release_artifact_binding_invalid')
  if (!Array.isArray(evidence.assertions) || evidence.assertions.length === 0 || !evidence.assertions.every((entry) => exact(entry, ASSERTION)
    && typeof entry.assertion_id === 'string' && entry.assertion_id.length >= 3 && entry.result === 'passed' && HEX64.test(entry.artifact_sha256))) throw new Error('assertions_invalid')
  if (!Array.isArray(evidence.skips) || evidence.skips.length !== 0) throw new Error('skips_invalid')
  if (!exact(evidence.cleanup, ['required', 'status', 'count', 'reason']) || evidence.cleanup.required !== false || evidence.cleanup.status !== 'not_required'
    || evidence.cleanup.count !== 0 || typeof evidence.cleanup.reason !== 'string' || evidence.cleanup.reason.length < 20) throw new Error('cleanup_invalid')
  if (!Array.isArray(bundle) || bundle.length === 0 || bundle.length > 8 || !Array.isArray(evidence.artifacts) || evidence.artifacts.length !== bundle.length) throw new Error('artifact_bundle_invalid')
  const bundleByPath = new Map()
  for (const entry of bundle) {
    if (!exact(entry, BUNDLE_ENTRY) || !safeRelative(entry.path) || typeof entry.bytes_base64 !== 'string' || !BASE64.test(entry.bytes_base64) || bundleByPath.has(entry.path)) throw new Error('artifact_bundle_entry_invalid')
    const bytes = Buffer.from(entry.bytes_base64, 'base64')
    if (bytes.length === 0 || bytes.length > 1_048_576 || bytes.toString('base64') !== entry.bytes_base64) throw new Error('artifact_bundle_bytes_invalid')
    bundleByPath.set(entry.path, bytes)
  }
  const artifactDigests = new Set()
  for (const artifact of evidence.artifacts) {
    const keys = [...ARTIFACT_BASE, ...(Object.prototype.hasOwnProperty.call(artifact ?? {}, 'media_type') ? ['media_type'] : [])]
    if (!exact(artifact, keys) || !safeRelative(artifact.path) || !HEX64.test(artifact.sha256) || !Number.isInteger(artifact.size_bytes)
      || artifact.size_bytes < 1 || !['assertion', 'log', 'cleanup', 'manifest', 'report'].includes(artifact.kind)) throw new Error('artifact_invalid')
    const bytes = bundleByPath.get(artifact.path)
    if (!bytes || bytes.length !== artifact.size_bytes || sha256(bytes) !== artifact.sha256) throw new Error('artifact_bytes_mismatch')
    artifactDigests.add(artifact.sha256)
  }
  if (!evidence.assertions.every((entry) => artifactDigests.has(entry.artifact_sha256))) throw new Error('assertion_artifact_unbound')
  if (evidence.release_binding.release_artifact_path && !evidence.artifacts.some((entry) => entry.path === evidence.release_binding.release_artifact_path
    && evidence.assertions.some((assertion) => assertion.artifact_sha256 === entry.sha256))) throw new Error('release_artifact_unasserted')
  const scope = `evidence:${evidence.release_binding.release_unit}:${evidence.release_binding.evidence_role}:${evidence.target.environment}${context.consumerUnit ? `:${context.consumerUnit}` : ''}`
  if (!context.allowedScopes.includes(scope)) throw new Error('scope_not_authorized')
  return bundleByPath
}

export function signRiskV2ReleaseEvidence({ evidence, bundle, privateKeyPkcs8Base64, context, outputDir }) {
  const bundleByPath = validateEvidence(evidence, bundle, context)
  if (typeof privateKeyPkcs8Base64 !== 'string' || !BASE64.test(privateKeyPkcs8Base64)) throw new Error('private_key_invalid')
  const privateKey = crypto.createPrivateKey({ key: Buffer.from(privateKeyPkcs8Base64, 'base64'), type: 'pkcs8', format: 'der' })
  if (privateKey.asymmetricKeyType !== 'ed25519') throw new Error('private_key_not_ed25519')
  const publicPem = Buffer.from(crypto.createPublicKey(privateKey).export({ type: 'spki', format: 'pem' }))
  if (sha256(publicPem) !== context.publicKeySha256) throw new Error('public_key_digest_mismatch')
  const signed = { ...structuredClone(evidence), attestation: { kind: 'external_signed_manifest', subject: context.subject,
    authorization_ref: context.authorizationRef, key_id: context.keyId, statement_sha256: '0'.repeat(64), signature_base64: 'AA==' } }
  signed.attestation.statement_sha256 = computeRiskV2EvidenceStatementSha256(signed)
  signed.attestation.signature_base64 = crypto.sign(null, Buffer.from(signed.attestation.statement_sha256, 'hex'), privateKey).toString('base64')
  const outputNames = new Set(['evidence.json'])
  const outputs = []
  for (const [relative, bytes] of bundleByPath) {
    const name = path.basename(relative)
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,159}$/.test(name) || outputNames.has(name)) throw new Error('artifact_filename_invalid')
    outputNames.add(name)
    outputs.push([name, bytes])
  }
  fs.mkdirSync(outputDir, { recursive: true })
  fs.writeFileSync(path.join(outputDir, 'evidence.json'), `${JSON.stringify(signed, null, 2)}\n`)
  for (const [name, bytes] of outputs) {
    fs.writeFileSync(path.join(outputDir, name), bytes)
  }
  return signed
}

export function bindVerifiedGithubRun(evidence, verifiedRunId) {
  if (evidence?.run?.run_id !== '__GITHUB_ACTIONS_RUN__'
    || typeof verifiedRunId !== 'string' || !/^github-actions:[a-z0-9._/-]+:[1-9][0-9]*:[1-9][0-9]*$/.test(verifiedRunId)) throw new Error('verified_run_binding_invalid')
  const bound = structuredClone(evidence)
  bound.run.run_id = verifiedRunId
  return bound
}

function environmentContext() {
  const parse = (name, maxEncodedLength) => parseBase64Json(process.env[name], name.toLowerCase(), maxEncodedLength)
  const config = parse('RISK_V2_SIGNER_CONFIG_BASE64')
  if (!exact(config, ['unit', 'release_unit', 'consumer_release_unit', 'key_id', 'subject', 'authorization_ref', 'public_key_sha256', 'allowed_scopes'])
    || !KEY_ID.test(config.key_id) || !HEX64.test(config.public_key_sha256) || !Array.isArray(config.allowed_scopes)) throw new Error('signer_config_invalid')
  const evidence = bindVerifiedGithubRun(parse('RISK_V2_EVIDENCE_BODY_BASE64'), process.env.RISK_V2_VERIFIED_RUN_ID)
  return {
    evidence,
    bundle: parse('RISK_V2_ARTIFACT_BUNDLE_BASE64', 2_000_000),
    privateKeyPkcs8Base64: process.env.RISK_V2_ED25519_PRIVATE_KEY_PKCS8_BASE64,
    outputDir: process.env.RISK_V2_OUTPUT_DIR,
    context: {
      unit: config.unit,
      releaseUnit: process.env.RISK_V2_EVIDENCE_ROLE === 'consumer_build' ? config.consumer_release_unit : config.release_unit,
      keyId: config.key_id,
      subject: config.subject,
      authorizationRef: config.authorization_ref,
      publicKeySha256: config.public_key_sha256,
      allowedScopes: config.allowed_scopes,
      sourceRef: process.env.RISK_V2_VERIFIED_SOURCE_REF,
      sourceSha: process.env.RISK_V2_VERIFIED_SOURCE_SHA,
      sourceTreeSha: process.env.RISK_V2_VERIFIED_SOURCE_TREE_SHA,
      runnerId: process.env.RISK_V2_RUNNER_ID,
      evidenceRole: process.env.RISK_V2_EVIDENCE_ROLE,
      consumerUnit: process.env.RISK_V2_CONSUMER_UNIT || null,
    },
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const secret = process.env.RISK_V2_ED25519_PRIVATE_KEY_PKCS8_BASE64
  delete process.env.RISK_V2_ED25519_PRIVATE_KEY_PKCS8_BASE64
  try {
    const input = environmentContext()
    input.privateKeyPkcs8Base64 = secret
    const signed = signRiskV2ReleaseEvidence(input)
    process.stdout.write(`RISK_V2_EVIDENCE_SIGNED=${signed.evidence_id}\n`)
  } catch (error) {
    process.stderr.write(`FAIL risk-v2 release evidence signer: ${error.message}\n`)
    process.exitCode = 1
  }
}
