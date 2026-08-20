#!/usr/bin/env node
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { assembleCheckinDeploymentObservation, verifyCheckinSourceObservation } from './checkin-readonly-workflow-evidence-lib.mjs'

const SOURCE = Object.freeze({ ref: 'refs/heads/evidence/risk-v2-w2-09-20260817', sha: '34c010a21f9c85f1cd1a4cc65104c159606e6458', tree: 'e88e56d4d11df910f9b2ebf91d41d21eadb01ce1', manifestSha: '744faa9f6f8146aeb626ee5573bd7d31d32086f238e4f9d892e52c90a8fa1232' })
const CONTEXT_SHA = '2266ae16bb23813ce8458934b227e98f5f4accc27b563a06b3bfa575bc398729'
const IMPACT_SHA = 'e44a151280c1d0747695948be71b0e740223c13e9e78df8662ca38f4d7deb378'
const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex')
const stable = (value) => Array.isArray(value) ? value.map(stable) : value && typeof value === 'object'
  ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])])) : value
const canonicalBytes = (value) => Buffer.from(JSON.stringify(stable(value)))
const commandSha = (argv) => sha256(canonicalBytes(argv))
const roles = Object.freeze({
  build: Object.freeze({ id: 'EVD-W2-09-CHECKIN-BUILD', type: 'negative', command: ['npm', 'run', 'build'], commandId: 'release-build:aurora-check-in' }),
  deployment: Object.freeze({ id: 'EVD-W2-09-CHECKIN-DEPLOYMENT', type: 'operational', command: ['verify-deployment-revision', '--unit', 'aurora-check-in', '--target', 'aurora-test'], commandId: 'release-deployment-verify:aurora-check-in' }),
  checkin_contract: Object.freeze({ id: 'EVD-W2-09-CHECKIN-CONTRACT', type: 'mutation', command: ['verify-checkin-release-contract', '--target', 'aurora-test'], commandId: 'release-checkin-contract:aurora-check-in' }),
})
function assertSource(ref, sha, tree) {
  if (ref !== SOURCE.ref || sha !== SOURCE.sha || tree !== SOURCE.tree) throw new Error('source_binding_invalid')
}
const role = process.env.RISK_V2_EVIDENCE_ROLE
const spec = roles[role]
if (process.env.GITHUB_REPOSITORY !== 'auroraverse-ops/aurora-check-in' || !spec || process.env.RISK_V2_CONSUMER_UNIT) throw new Error('workflow_context_invalid')
assertSource(process.env.RISK_V2_VERIFIED_SOURCE_REF, process.env.RISK_V2_VERIFIED_SOURCE_SHA, process.env.RISK_V2_VERIFIED_SOURCE_TREE_SHA)
const startedAt = process.env.RISK_V2_STARTED_AT
const finishedAt = process.env.RISK_V2_FINISHED_AT
const outputDir = process.env.RISK_V2_BUILDER_OUTPUT_DIR
if (!outputDir || !Number.isFinite(Date.parse(startedAt)) || !Number.isFinite(Date.parse(finishedAt)) || Date.parse(finishedAt) < Date.parse(startedAt)) throw new Error('builder_input_invalid')
fs.mkdirSync(outputDir, { recursive: true })
const artifacts = []
const add = (file, bytes, kind = 'report', media = 'application/json') => {
  if (!Buffer.isBuffer(bytes) || bytes.length < 1 || bytes.length > 1_048_576) throw new Error('artifact_bytes_invalid')
  artifacts.push({ path: `docs/06-testing/evidence/risk-v2-baseline/release-evidence/${file}`, bytes, sha256: sha256(bytes), kind, media })
}
let observation = null
if (role === 'build') {
  const buildLog = fs.readFileSync(process.env.RISK_V2_RAW_ARTIFACT_PATH)
  add('checkin-build-workflow-report.txt', buildLog, 'report', 'text/plain')
  let rejected = false
  try { assertSource(SOURCE.ref, '0'.repeat(40), SOURCE.tree) } catch (error) { rejected = error.message === 'source_binding_invalid' }
  if (!rejected) throw new Error('negative_control_failed')
  add('checkin-build-negative-control.json', canonicalBytes({ schema: 'checkin-build-negative-control', schema_version: 1,
    build_artifact_sha256: sha256(buildLog), foreign_source_rejected_before_signing: true, expected_error: 'source_binding_invalid' }))
} else {
  const frontend = JSON.parse(fs.readFileSync(process.env.RISK_V2_FRONTEND_OBSERVATION_PATH, 'utf8'))
  const edge = JSON.parse(fs.readFileSync(process.env.RISK_V2_EDGE_OBSERVATION_PATH, 'utf8'))
  const assembled = assembleCheckinDeploymentObservation(frontend, edge, Date.parse(finishedAt) + 5_000)
  observation = assembled.observation
  if (role === 'deployment') add('checkin-deployment-observation.json', canonicalBytes(observation), 'manifest')
  else {
    add('checkin-deployment-digest.json', assembled.digestBytes, 'manifest')
    const mutation = structuredClone(frontend); mutation.target.target_id = 'foreign'
    let rejected = false
    try { verifyCheckinSourceObservation(mutation, 'frontend_deployment', Date.parse(finishedAt) + 5_000) } catch (error) { rejected = error.message === 'CHECKIN_SOURCE_OBSERVATION_INVALID' }
    if (!rejected) throw new Error('mutation_control_failed')
    add('checkin-contract-mutation-report.json', canonicalBytes({ schema: 'checkin-contract-mutation-proof', schema_version: 1,
      deployment_digest_sha256: observation.deployment.deployment_digest_sha256, target_mutation_rejected: true, expected_error: 'CHECKIN_SOURCE_OBSERVATION_INVALID' }))
    const manifestBytes = fs.readFileSync(process.env.RISK_V2_SOURCE_MANIFEST_PATH)
    if (sha256(manifestBytes) !== SOURCE.manifestSha) throw new Error('source_manifest_digest_invalid')
    const manifest = JSON.parse(manifestBytes.toString('utf8'))
    if (manifest?.source?.commit_sha !== SOURCE.sha || manifest?.source?.tree_sha !== SOURCE.tree
      || manifest?.contracts?.api_contract_version !== 'checkin-config-submit-v1') throw new Error('source_manifest_binding_invalid')
    const contract = { schema_version: 1, attestation_id: `ATT-CHECKIN-WORKFLOW-${process.env.GITHUB_RUN_ID}`,
      unit: 'aurora-check-in', source: { repository: 'aurora-check-in', commit_sha: SOURCE.sha, tree_sha: SOURCE.tree, manifest_sha256: SOURCE.manifestSha },
      target: observation.target, api_contract_version: manifest.contracts.api_contract_version, edge: observation.edge,
      deployment: observation.deployment, evidence_ids: ['EVD-W2-09-CHECKIN-DEPLOYMENT', 'EVD-W2-09-CHECKIN-CONTRACT'],
      timing: { observed_at: observation.timing.observed_until, valid_until: new Date(Date.parse(finishedAt) + 23 * 60 * 60 * 1000).toISOString() } }
    fs.writeFileSync(path.join(outputDir, 'checkin-contract-body.json'), JSON.stringify(contract))
  }
}
const primary = artifacts[0]
const local = role === 'build'
const releaseBinding = { impact_fingerprint_sha256: IMPACT_SHA, release_context_sha256: CONTEXT_SHA, release_unit: 'aurora-check-in', evidence_role: role }
if (role !== 'deployment') releaseBinding.release_artifact_path = primary.path
if (!local) releaseBinding.deployment_revision_sha256 = observation.deployment.revision_sha256
const evidence = { schema_version: 1, evidence_id: spec.id, claim_ids: ['RISK-RELEASE-BUNDLE-COMPLETE'], evidence_type: spec.type, outcome: 'passed',
  repository: { name: 'aurora-check-in', ref: SOURCE.ref, commit_sha: SOURCE.sha, tree_sha: SOURCE.tree, worktree_clean: true },
  run: { run_id: '__GITHUB_ACTIONS_RUN__', runner_id: 'github-actions:auroraverse-ops/aurora-check-in', command_id: spec.commandId, command_argv_sha256: commandSha(spec.command), exit_code: 0 },
  target: local ? { environment: 'local', target_id: 'github-actions-checkin-build', environment_fingerprint_sha256: sha256(`${SOURCE.sha}\0${SOURCE.tree}\0${commandSha(spec.command)}`), write_mode: 'none' }
    : { environment: 'aurora-test', target_id: 'aurora-test', environment_fingerprint_sha256: observation.target.environment_fingerprint_sha256, write_mode: 'none' },
  timing: { started_at: startedAt, finished_at: finishedAt }, release_binding: releaseBinding,
  assertions: artifacts.map((entry, index) => ({ assertion_id: `${role.replace('_', '-')}-artifact-${index + 1}-verified`, result: 'passed', artifact_sha256: entry.sha256 })), skips: [],
  cleanup: { required: false, status: 'not_required', count: 0, reason: 'Der Workflow nutzt nur lokale Builds und zwei technisch erzwungene Read-only-Observer ohne Remote-Wirkung.' },
  artifacts: artifacts.map(({ path: artifactPath, bytes, sha256: digest, kind, media }) => ({ path: artifactPath, sha256: digest, size_bytes: bytes.length, kind, media_type: media })) }
fs.writeFileSync(path.join(outputDir, 'body.json'), JSON.stringify(evidence))
fs.writeFileSync(path.join(outputDir, 'bundle.json'), JSON.stringify(artifacts.map(({ path: artifactPath, bytes }) => ({ path: artifactPath, bytes_base64: bytes.toString('base64') }))))
process.stdout.write(`WRITE workflow-owned evidence body ${spec.id}\n`)
