import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { computeRiskV2EvidenceStatementSha256, signRiskV2ReleaseEvidence } from '../../tools/sign-risk-v2-release-evidence.mjs'

const roots: string[] = []
const sha256 = (value: Buffer) => crypto.createHash('sha256').update(value).digest('hex')
afterEach(() => { for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true }) })

function fixture() {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('ed25519')
  const bytes = Buffer.from('{"command":"npm run build","exit_code":0}')
  const artifactPath = 'docs/06-testing/evidence/risk-v2-baseline/release-evidence/checkin-build.json'
  const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'checkin-evidence-signer-')); roots.push(outputDir)
  const context = { unit: 'aurora-check-in', releaseUnit: 'aurora-check-in', keyId: 'KEY-CHECKIN-CI-EVIDENCE-01',
    subject: 'checkin-ci-evidence-signer', authorizationRef: 'trust-enrollment:checkin-ci-evidence:2026-08-18',
    publicKeySha256: sha256(Buffer.from(publicKey.export({ type: 'spki', format: 'pem' }))),
    allowedScopes: ['evidence:aurora-check-in:build:local'], sourceRef: 'refs/heads/main', sourceSha: 'a'.repeat(40),
    sourceTreeSha: 'b'.repeat(40), runnerId: 'github-actions:auroraverse-ops/aurora-check-in', evidenceRole: 'build', consumerUnit: null }
  const evidence = { schema_version: 1, evidence_id: 'EVD-W2-09-CHECKIN-BUILD', claim_ids: ['RISK-RELEASE-BUNDLE-COMPLETE'],
    evidence_type: 'positive', outcome: 'passed', repository: { name: context.unit, ref: context.sourceRef, commit_sha: context.sourceSha,
      tree_sha: context.sourceTreeSha, worktree_clean: true }, run: { run_id: 'fixture', runner_id: context.runnerId,
      command_id: 'release-build:aurora-check-in', command_argv_sha256: 'c'.repeat(64), exit_code: 0 },
    target: { environment: 'local', target_id: 'local-build', environment_fingerprint_sha256: 'd'.repeat(64), write_mode: 'none' },
    timing: { started_at: '2026-08-20T10:00:00.000Z', finished_at: '2026-08-20T10:01:00.000Z' },
    release_binding: { impact_fingerprint_sha256: 'e'.repeat(64), release_context_sha256: 'f'.repeat(64), release_unit: context.releaseUnit,
      evidence_role: 'build', release_artifact_path: artifactPath },
    assertions: [{ assertion_id: 'build-readback', result: 'passed', artifact_sha256: sha256(bytes) }], skips: [],
    cleanup: { required: false, status: 'not_required', count: 0, reason: 'Der isolierte Build benoetigt keinen externen Cleanup.' },
    artifacts: [{ path: artifactPath, sha256: sha256(bytes), size_bytes: bytes.length, kind: 'report', media_type: 'application/json' }] }
  return { evidence, bundle: [{ path: artifactPath, bytes_base64: bytes.toString('base64') }], context, outputDir,
    privateKeyPkcs8Base64: privateKey.export({ type: 'pkcs8', format: 'der' }).toString('base64'), publicKey }
}

describe('safe risk-v2 release evidence signer', () => {
  it('creates the attestation exclusively from the trusted signer context', () => {
    const input = fixture(); const signed = signRiskV2ReleaseEvidence(input)
    expect(input.evidence).not.toHaveProperty('attestation')
    expect(signed.attestation).toEqual(expect.objectContaining({ key_id: input.context.keyId, subject: input.context.subject,
      authorization_ref: input.context.authorizationRef }))
    expect(signed.attestation.statement_sha256).toBe(computeRiskV2EvidenceStatementSha256(signed))
    expect(crypto.verify(null, Buffer.from(signed.attestation.statement_sha256, 'hex'), input.publicKey,
      Buffer.from(signed.attestation.signature_base64, 'base64'))).toBe(true)
  })

  it('rejects any caller-supplied attestation before output', () => {
    const input = fixture(); (input.evidence as Record<string, unknown>).attestation = { key_id: 'KEY-FOREIGN-EVIDENCE-01' }
    expect(() => signRiskV2ReleaseEvidence(input)).toThrow('evidence_identity_invalid')
    expect(fs.readdirSync(input.outputDir)).toHaveLength(0)
  })
})
