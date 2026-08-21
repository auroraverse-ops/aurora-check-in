import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { afterEach, describe, expect, it } from 'vitest'
import { assembleCheckinDeploymentObservation, verifyCheckinSourceObservation } from '../../tools/checkin-readonly-workflow-evidence-lib.mjs'

const roots = []
afterEach(() => { for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true }) })
function sources() {
  const now = Date.now()
  return {
    now,
    frontend: { schema: 'aurora-checkin-readonly-source-observation', schema_version: 1, observation_id: 'OBS-SOURCE-CHECKIN-FRONTEND-V2', role: 'frontend_deployment', kind: 'deployment_management_metadata', source_id: 'prepaid-test-checkin-frontend-v2', source_identity_sha256: 'ef2e625b99f31d6769cb2adeb6224bc26ed41188e116ff3a1646bd315132d407', authorization_ref: 'charter:aur-rm-w2-09-dual-source-v2-20260819', access_mode: 'read_only_metadata', observed_at: new Date(now - 2_000).toISOString().replace(/\.\d{3}Z$/, '.000Z'), target: { environment: 'aurora-test', target_id: 'aurora-test' }, payload: { application_id: 'gcw1fg05g10jz5bc8xfrk1sb', deployment_revision_sha256: 'a'.repeat(64) } },
    edge: { schema: 'aurora-checkin-readonly-source-observation', schema_version: 1, observation_id: 'OBS-SOURCE-CHECKIN-EDGE-V2', role: 'edge_runtime', kind: 'deployment_management_metadata', source_id: 'prepaid-test-checkin-edge-v2', source_identity_sha256: 'f0138beb33ceccc9dc8d8988c71ae14637a0f30b02f2237d28e3df21f0fd3e4a', authorization_ref: 'charter:aur-rm-w2-09-dual-source-v2-20260819', access_mode: 'read_only_metadata', observed_at: new Date(now - 1_000).toISOString().replace(/\.\d{3}Z$/, '.000Z'), target: { environment: 'aurora-test', target_id: 'aurora-test' }, payload: { functions: [{ id: 'checkin-config', revision_sha256: 'b'.repeat(64) }, { id: 'checkin-submit', revision_sha256: 'c'.repeat(64) }] } },
  }
}

describe('workflow-owned check-in evidence', () => {
  it('assembles two independently pinned read-only observations', () => {
    const input = sources()
    const result = assembleCheckinDeploymentObservation(input.frontend, input.edge, input.now)
    expect(result.observation).toMatchObject({ schema_version: 2, deployment: { revision_sha256: 'a'.repeat(64) } })
    expect(result.observation.effects).toEqual(expect.objectContaining({ remote_writes: 0, deployments: 0, secret_reads: 0 }))
    expect(result.observation.deployment.deployment_digest_sha256).toMatch(/^[a-f0-9]{64}$/)
  })

  it('rejects identity, target, unknown-field and time-window mutations', () => {
    const input = sources()
    for (const mutate of [
      (v) => { v.frontend.source_identity_sha256 = '0'.repeat(64) },
      (v) => { v.frontend.target.target_id = 'foreign' },
      (v) => { v.frontend.extra = true },
      (v) => { v.edge.observed_at = new Date(v.now + 1_000).toISOString().replace(/\.\d{3}Z$/, '.000Z') },
      (v) => { v.frontend.observed_at = new Date(v.now - 301_000).toISOString().replace(/\.\d{3}Z$/, '.000Z') },
    ]) {
      const value = structuredClone(input); mutate(value)
      expect(() => assembleCheckinDeploymentObservation(value.frontend, value.edge, value.now)).toThrow()
    }
  })

  it('keeps caller-owned evidence bodies out of the workflow and uses only forced observers', () => {
    const workflow = fs.readFileSync(path.resolve('.github/workflows/risk-v2-release-evidence.yml'), 'utf8')
    expect(workflow).not.toContain('evidence_body_base64:')
    expect(workflow).not.toContain('artifact_bundle_base64:')
    expect(workflow).toContain('runs-on: [self-hosted, aski-ops-checkin-evidence]')
    expect(workflow.match(/ssh -T/g)).toHaveLength(2)
    expect(workflow).toContain('aurora_obs_frontend@185.245.61.192')
    expect(workflow).toContain('aurora_obs_edge@185.245.61.192')
    expect(workflow).toContain('--output .release-artifacts/risk-v2-checkin-source-manifest.json')
    expect(workflow).not.toContain('--output "$RUNNER_TEMP/risk-v2-checkin-source-manifest.json"')
  })

  it('builds negative build evidence only after actual raw build output and a rejected foreign source', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'checkin-workflow-builder-')); roots.push(root)
    const raw = path.join(root, 'build.txt'); fs.writeFileSync(raw, 'vite build passed\n')
    const output = path.join(root, 'out')
    const result = spawnSync(process.execPath, [path.resolve('tools/build-risk-v2-workflow-evidence.mjs')], { encoding: 'utf8', env: { ...process.env,
      GITHUB_REPOSITORY: 'auroraverse-ops/aurora-check-in', GITHUB_RUN_ID: '12345', RISK_V2_EVIDENCE_ROLE: 'build', RISK_V2_CONSUMER_UNIT: '',
      RISK_V2_VERIFIED_SOURCE_REF: 'refs/heads/evidence/risk-v2-w2-09-20260817', RISK_V2_VERIFIED_SOURCE_SHA: '34c010a21f9c85f1cd1a4cc65104c159606e6458',
      RISK_V2_VERIFIED_SOURCE_TREE_SHA: 'e88e56d4d11df910f9b2ebf91d41d21eadb01ce1', RISK_V2_STARTED_AT: '2026-08-20T22:00:00.000Z',
      RISK_V2_FINISHED_AT: '2026-08-20T22:01:00.000Z', RISK_V2_RAW_ARTIFACT_PATH: raw, RISK_V2_BUILDER_OUTPUT_DIR: output } })
    expect(result.status, result.stderr).toBe(0)
    const evidence = JSON.parse(fs.readFileSync(path.join(output, 'body.json'), 'utf8'))
    expect(evidence).toMatchObject({ evidence_id: 'EVD-W2-09-CHECKIN-BUILD', evidence_type: 'negative', outcome: 'passed' })
    expect(evidence.artifacts).toHaveLength(2)
    expect(() => verifyCheckinSourceObservation({})).toThrow()
  })

  it('builds operational deployment evidence only from both fresh observer documents', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'checkin-workflow-deployment-')); roots.push(root)
    const input = sources()
    const frontend = path.join(root, 'frontend.json'); fs.writeFileSync(frontend, JSON.stringify(input.frontend))
    const edge = path.join(root, 'edge.json'); fs.writeFileSync(edge, JSON.stringify(input.edge))
    const output = path.join(root, 'out')
    const result = spawnSync(process.execPath, [path.resolve('tools/build-risk-v2-workflow-evidence.mjs')], { encoding: 'utf8', env: { ...process.env,
      GITHUB_REPOSITORY: 'auroraverse-ops/aurora-check-in', GITHUB_RUN_ID: '12346', RISK_V2_EVIDENCE_ROLE: 'deployment', RISK_V2_CONSUMER_UNIT: '',
      RISK_V2_VERIFIED_SOURCE_REF: 'refs/heads/evidence/risk-v2-w2-09-20260817', RISK_V2_VERIFIED_SOURCE_SHA: '34c010a21f9c85f1cd1a4cc65104c159606e6458',
      RISK_V2_VERIFIED_SOURCE_TREE_SHA: 'e88e56d4d11df910f9b2ebf91d41d21eadb01ce1', RISK_V2_STARTED_AT: new Date(input.now - 3_000).toISOString(),
      RISK_V2_FINISHED_AT: new Date(input.now).toISOString(), RISK_V2_FRONTEND_OBSERVATION_PATH: frontend,
      RISK_V2_EDGE_OBSERVATION_PATH: edge, RISK_V2_BUILDER_OUTPUT_DIR: output } })
    expect(result.status, result.stderr).toBe(0)
    const evidence = JSON.parse(fs.readFileSync(path.join(output, 'body.json'), 'utf8'))
    expect(evidence).toMatchObject({ evidence_id: 'EVD-W2-09-CHECKIN-DEPLOYMENT', evidence_type: 'operational', outcome: 'passed',
      target: { environment: 'aurora-test', write_mode: 'none' }, cleanup: { status: 'not_required', count: 0 } })
    expect(evidence.release_binding.deployment_revision_sha256).toBe('a'.repeat(64))
  })
})
