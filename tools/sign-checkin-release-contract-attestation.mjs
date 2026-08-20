#!/usr/bin/env node
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const HEX40 = /^[a-f0-9]{40}$/
const HEX64 = /^[a-f0-9]{64}$/
const BASE64 = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/
const stable = (value) => Array.isArray(value) ? value.map(stable)
  : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])])) : value
const canonical = (value) => JSON.stringify(stable(value))
const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex')
const exact = (value, keys) => value && Object.getPrototypeOf(value) === Object.prototype
  && Object.keys(value).sort().join('\0') === [...keys].sort().join('\0') && Object.getOwnPropertySymbols(value).length === 0
const utc = (value) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)
  && new Date(value).toISOString() === value

const TOP = ['schema_version', 'attestation_id', 'unit', 'source', 'target', 'api_contract_version', 'edge', 'deployment', 'evidence_ids', 'timing', 'attestation']
const SOURCE = ['repository', 'commit_sha', 'tree_sha', 'manifest_sha256']
const TARGET = ['environment', 'target_id', 'environment_fingerprint_sha256']
const EDGE = ['functions', 'aggregate_sha256']
const FUNCTION = ['id', 'revision_sha256']
const DEPLOYMENT = ['revision_sha256', 'deployment_digest_sha256']
const TIMING = ['observed_at', 'valid_until']
const ATTESTATION = ['kind', 'subject', 'authorization_ref', 'key_id', 'statement_sha256', 'signature_base64']

export function computeCheckinContractStatementSha256(document) {
  const { attestation, ...body } = document
  return sha256(canonical({ ...body, attestation: { kind: attestation.kind, subject: attestation.subject,
    authorization_ref: attestation.authorization_ref, key_id: attestation.key_id } }))
}

function validate(document, context) {
  if (!exact(document, TOP) || document.schema_version !== 1 || document.unit !== 'aurora-check-in'
    || !/^ATT-CHECKIN-[A-Z0-9][A-Z0-9-]{5,99}$/.test(document.attestation_id ?? '')) throw new Error('contract_identity_invalid')
  if (!exact(document.source, SOURCE) || document.source.repository !== 'aurora-check-in'
    || document.source.commit_sha !== context.sourceSha || document.source.tree_sha !== context.sourceTreeSha
    || !HEX40.test(document.source.commit_sha) || !HEX40.test(document.source.tree_sha) || !HEX64.test(document.source.manifest_sha256)) throw new Error('source_binding_invalid')
  if (!exact(document.target, TARGET) || document.target.environment !== 'aurora-test' || document.target.target_id !== 'aurora-test'
    || !HEX64.test(document.target.environment_fingerprint_sha256)) throw new Error('target_binding_invalid')
  if (typeof document.api_contract_version !== 'string' || document.api_contract_version.length < 1 || document.api_contract_version.length > 120) throw new Error('api_contract_invalid')
  if (!exact(document.edge, EDGE) || !Array.isArray(document.edge.functions) || document.edge.functions.length !== 2
    || document.edge.functions[0]?.id !== 'checkin-config' || document.edge.functions[1]?.id !== 'checkin-submit'
    || !document.edge.functions.every((entry) => exact(entry, FUNCTION) && HEX64.test(entry.revision_sha256))
    || !HEX64.test(document.edge.aggregate_sha256)) throw new Error('edge_binding_invalid')
  if (!exact(document.deployment, DEPLOYMENT) || !HEX64.test(document.deployment.revision_sha256)
    || !HEX64.test(document.deployment.deployment_digest_sha256)) throw new Error('deployment_binding_invalid')
  if (!Array.isArray(document.evidence_ids) || document.evidence_ids.length !== 2 || new Set(document.evidence_ids).size !== 2
    || document.evidence_ids.some((id) => !/^EVD-[A-Z0-9][A-Z0-9-]{5,119}$/.test(id))) throw new Error('evidence_binding_invalid')
  if (!exact(document.timing, TIMING) || !utc(document.timing.observed_at) || !utc(document.timing.valid_until)
    || Date.parse(document.timing.valid_until) <= Date.parse(document.timing.observed_at)
    || Date.parse(document.timing.observed_at) > Date.now() + 5_000 || Date.parse(document.timing.valid_until) < Date.now()
    || Date.parse(document.timing.valid_until) > Date.now() + 86_405_000) throw new Error('timing_invalid')
  if (!exact(document.attestation, ATTESTATION) || document.attestation.kind !== 'external_signed_manifest'
    || document.attestation.subject !== context.subject || document.attestation.authorization_ref !== context.authorizationRef
    || document.attestation.key_id !== context.keyId || document.attestation.statement_sha256 !== '0'.repeat(64)
    || document.attestation.signature_base64 !== 'AA==') throw new Error('attestation_template_invalid')
}

export function signCheckinReleaseContractAttestation({ document, privateKeyPkcs8Base64, context, outputDir }) {
  validate(document, context)
  if (typeof privateKeyPkcs8Base64 !== 'string' || !BASE64.test(privateKeyPkcs8Base64)) throw new Error('private_key_invalid')
  const privateKey = crypto.createPrivateKey({ key: Buffer.from(privateKeyPkcs8Base64, 'base64'), format: 'der', type: 'pkcs8' })
  if (privateKey.asymmetricKeyType !== 'ed25519') throw new Error('private_key_not_ed25519')
  const publicPem = Buffer.from(crypto.createPublicKey(privateKey).export({ format: 'pem', type: 'spki' }))
  if (sha256(publicPem) !== context.publicKeySha256) throw new Error('public_key_digest_mismatch')
  const signed = structuredClone(document)
  signed.attestation.statement_sha256 = computeCheckinContractStatementSha256(signed)
  signed.attestation.signature_base64 = crypto.sign(null, Buffer.from(signed.attestation.statement_sha256, 'hex'), privateKey).toString('base64')
  fs.mkdirSync(outputDir, { recursive: true })
  const output = path.join(outputDir, 'checkin-release-contract-attestation.json')
  const descriptor = fs.openSync(output, 'wx', 0o600)
  try { fs.writeFileSync(descriptor, `${JSON.stringify(signed, null, 2)}\n`) } finally { fs.closeSync(descriptor) }
  return signed
}

function parse(name) {
  const encoded = process.env[name]
  if (typeof encoded !== 'string' || !BASE64.test(encoded)) throw new Error(`${name.toLowerCase()}_invalid`)
  const bytes = Buffer.from(encoded, 'base64')
  if (bytes.toString('base64') !== encoded) throw new Error(`${name.toLowerCase()}_noncanonical`)
  const value = JSON.parse(bytes.toString('utf8'))
  if (!Buffer.from(JSON.stringify(value)).equals(bytes)) throw new Error(`${name.toLowerCase()}_json_noncanonical`)
  return value
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const secret = process.env.RISK_V2_ED25519_PRIVATE_KEY_PKCS8_BASE64
  delete process.env.RISK_V2_ED25519_PRIVATE_KEY_PKCS8_BASE64
  try {
    const config = parse('RISK_V2_SIGNER_CONFIG_BASE64')
    if (!exact(config, ['key_id', 'subject', 'authorization_ref', 'public_key_sha256']) || !HEX64.test(config.public_key_sha256)) throw new Error('signer_config_invalid')
    const signed = signCheckinReleaseContractAttestation({ document: parse('RISK_V2_CHECKIN_CONTRACT_INPUT_BASE64'),
      privateKeyPkcs8Base64: secret, context: { ...config, sourceSha: process.env.RISK_V2_VERIFIED_SOURCE_SHA,
        sourceTreeSha: process.env.RISK_V2_VERIFIED_SOURCE_TREE_SHA }, outputDir: process.env.RISK_V2_OUTPUT_DIR })
    process.stdout.write(`CHECKIN_CONTRACT_ATTESTATION_SIGNED=${signed.attestation_id}\n`)
  } catch (error) {
    process.stderr.write(`FAIL check-in contract attestation signer: ${error.message}\n`)
    process.exitCode = 1
  }
}
