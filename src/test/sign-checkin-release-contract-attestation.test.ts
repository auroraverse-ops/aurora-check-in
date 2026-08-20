import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { computeCheckinContractStatementSha256, signCheckinReleaseContractAttestation } from '../../tools/sign-checkin-release-contract-attestation.mjs'
import { bindVerifiedGithubRun } from '../../tools/sign-risk-v2-release-evidence.mjs'

const roots = []
afterEach(() => { for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true }) })
function fixture() {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('ed25519')
  const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'checkin-contract-signer-')); roots.push(outputDir)
  const now = Date.now()
  const context = { keyId: 'KEY-CHECKIN-CI-EVIDENCE-01', subject: 'checkin-ci-evidence-signer',
    authorizationRef: 'trust-enrollment:checkin-ci-evidence:2026-08-18', sourceSha: '1'.repeat(40), sourceTreeSha: '2'.repeat(40),
    publicKeySha256: crypto.createHash('sha256').update(publicKey.export({ format: 'pem', type: 'spki' })).digest('hex') }
  const document = { schema_version: 1, attestation_id: 'ATT-CHECKIN-RELEASE-20260820', unit: 'aurora-check-in',
    source: { repository: 'aurora-check-in', commit_sha: context.sourceSha, tree_sha: context.sourceTreeSha, manifest_sha256: '3'.repeat(64) },
    target: { environment: 'aurora-test', target_id: 'aurora-test', environment_fingerprint_sha256: '4'.repeat(64) }, api_contract_version: 'checkin-config-submit-v1',
    edge: { functions: [{ id: 'checkin-config', revision_sha256: '5'.repeat(64) }, { id: 'checkin-submit', revision_sha256: '6'.repeat(64) }], aggregate_sha256: '7'.repeat(64) },
    deployment: { revision_sha256: '8'.repeat(64), deployment_digest_sha256: '9'.repeat(64) },
    evidence_ids: ['EVD-CHECKIN-DEPLOYMENT-20260820', 'EVD-CHECKIN-CONTRACT-20260820'],
    timing: { observed_at: new Date(now - 1_000).toISOString(), valid_until: new Date(now + 86_000_000).toISOString() } }
  return { document, context, outputDir, privateKeyPkcs8Base64: privateKey.export({ format: 'der', type: 'pkcs8' }).toString('base64'), publicKey }
}

describe('check-in release contract attestation signer', () => {
  it('binds generic evidence only to the verified Actions run identity', () => {
    const evidence = { run: { run_id: '__GITHUB_ACTIONS_RUN__' } }
    const bound = bindVerifiedGithubRun(evidence, 'github-actions:auroraverse-ops/aurora-check-in:12345:1')
    expect(bound.run.run_id).toBe('github-actions:auroraverse-ops/aurora-check-in:12345:1')
    expect(evidence.run.run_id).toBe('__GITHUB_ACTIONS_RUN__')
    expect(() => bindVerifiedGithubRun({ run: { run_id: 'caller' } }, 'github-actions:auroraverse-ops/aurora-check-in:12345:1')).toThrow('verified_run_binding_invalid')
  })
  it('signs the exact closed contract and writes it once', () => {
    const input = fixture(); const signed = signCheckinReleaseContractAttestation(input)
    expect(signed.attestation.statement_sha256).toBe(computeCheckinContractStatementSha256(signed))
    expect(signed.attestation).toEqual(expect.objectContaining({ kind: 'external_signed_manifest', subject: input.context.subject,
      authorization_ref: input.context.authorizationRef, key_id: input.context.keyId }))
    expect(input.document).not.toHaveProperty('attestation')
    expect(crypto.verify(null, Buffer.from(signed.attestation.statement_sha256, 'hex'), input.publicKey, Buffer.from(signed.attestation.signature_base64, 'base64'))).toBe(true)
    expect(JSON.parse(fs.readFileSync(path.join(input.outputDir, 'checkin-release-contract-attestation.json'), 'utf8'))).toEqual(signed)
    expect(() => signCheckinReleaseContractAttestation(input)).toThrow()
  })

  it.each([
    ['foreign source', (v) => { v.document.source.commit_sha = 'a'.repeat(40) }, 'source_binding_invalid'],
    ['foreign target', (v) => { v.document.target.target_id = 'foreign' }, 'target_binding_invalid'],
    ['unknown field', (v) => { v.document.extra = true }, 'contract_identity_invalid'],
    ['duplicate evidence', (v) => { v.document.evidence_ids[1] = v.document.evidence_ids[0] }, 'evidence_binding_invalid'],
    ['caller attestation', (v) => { v.document.attestation = { key_id: 'KEY-FOREIGN-EVIDENCE-01' } }, 'contract_identity_invalid'], // gitleaks:allow -- public test key identifier
  ])('rejects %s before output', (_name, mutate, message) => {
    const input = fixture(); mutate(input)
    expect(() => signCheckinReleaseContractAttestation(input)).toThrow(message)
    expect(fs.readdirSync(input.outputDir)).toHaveLength(0)
  })
})
