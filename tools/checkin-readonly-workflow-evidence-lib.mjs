import crypto from 'node:crypto'

const HEX64 = /^[a-f0-9]{64}$/
const UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.000Z$/
const exact = (value, keys) => value && Object.getPrototypeOf(value) === Object.prototype
  && Object.keys(value).sort().join('\0') === [...keys].sort().join('\0') && Object.getOwnPropertySymbols(value).length === 0
const stable = (value) => Array.isArray(value) ? value.map(stable) : value && typeof value === 'object'
  ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])])) : value
const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex')
const SOURCE = ['schema', 'schema_version', 'observation_id', 'role', 'kind', 'source_id', 'source_identity_sha256', 'authorization_ref', 'access_mode', 'observed_at', 'target', 'payload']
const FUNCTIONS = ['id', 'revision_sha256']
const trusted = Object.freeze({
  frontend_deployment: Object.freeze({ source_id: 'prepaid-test-checkin-frontend-v2', source_identity_sha256: 'ef2e625b99f31d6769cb2adeb6224bc26ed41188e116ff3a1646bd315132d407', authorization_ref: 'charter:aur-rm-w2-09-dual-source-v2-20260819', application_id: 'gcw1fg05g10jz5bc8xfrk1sb' }),
  edge_runtime: Object.freeze({ source_id: 'prepaid-test-checkin-edge-v2', source_identity_sha256: 'f0138beb33ceccc9dc8d8988c71ae14637a0f30b02f2237d28e3df21f0fd3e4a', authorization_ref: 'charter:aur-rm-w2-09-dual-source-v2-20260819' }),
})

export function verifyCheckinSourceObservation(value, role, now = Date.now()) {
  const pin = trusted[role]
  if (!pin || !exact(value, SOURCE) || value.schema !== 'aurora-checkin-readonly-source-observation' || value.schema_version !== 1
    || value.role !== role || value.kind !== 'deployment_management_metadata' || value.source_id !== pin.source_id
    || value.source_identity_sha256 !== pin.source_identity_sha256 || value.authorization_ref !== pin.authorization_ref
    || value.access_mode !== 'read_only_metadata' || !UTC.test(value.observed_at) || new Date(value.observed_at).toISOString() !== value.observed_at
    || Date.parse(value.observed_at) > now || now - Date.parse(value.observed_at) > 300_000 || !exact(value.target, ['environment', 'target_id'])
    || value.target.environment !== 'aurora-test' || value.target.target_id !== 'aurora-test') throw new Error('CHECKIN_SOURCE_OBSERVATION_INVALID')
  if (role === 'frontend_deployment') {
    if (!exact(value.payload, ['application_id', 'deployment_revision_sha256']) || value.payload.application_id !== pin.application_id
      || !HEX64.test(value.payload.deployment_revision_sha256)) throw new Error('CHECKIN_FRONTEND_OBSERVATION_INVALID')
  } else if (!exact(value.payload, ['functions']) || !Array.isArray(value.payload.functions) || value.payload.functions.length !== 2
    || value.payload.functions[0]?.id !== 'checkin-config' || value.payload.functions[1]?.id !== 'checkin-submit'
    || !value.payload.functions.every((entry) => exact(entry, FUNCTIONS) && HEX64.test(entry.revision_sha256))) throw new Error('CHECKIN_EDGE_OBSERVATION_INVALID')
  return structuredClone(value)
}

export function assembleCheckinDeploymentObservation(frontendInput, edgeInput, now = Date.now()) {
  const frontend = verifyCheckinSourceObservation(frontendInput, 'frontend_deployment', now)
  const edge = verifyCheckinSourceObservation(edgeInput, 'edge_runtime', now)
  const from = Date.parse(frontend.observed_at)
  const until = Date.parse(edge.observed_at)
  if (from > until || until - from > 300_000) throw new Error('CHECKIN_OBSERVATION_WINDOW_INVALID')
  const sources = [frontend, edge].map(({ role, kind, source_id, source_identity_sha256, authorization_ref, access_mode, observed_at }) => ({ role, kind, source_id, source_identity_sha256, authorization_ref, access_mode, observed_at }))
  const environmentFingerprint = sha256(Buffer.from(JSON.stringify(stable({ schema: 'aurora-checkin-environment-fingerprint', schema_version: 2,
    environment: 'aurora-test', target_id: 'aurora-test', management_sources: sources.map(({ role, source_id, source_identity_sha256 }) => ({ role, source_id, source_identity_sha256 })).sort((a, b) => a.role.localeCompare(b.role, 'en')) }))))
  const functions = edge.payload.functions.map((entry) => ({ ...entry }))
  const edgeAggregate = sha256(Buffer.from([...functions].sort((a, b) => a.id.localeCompare(b.id, 'en')).map((entry) => `${entry.id}\0${entry.revision_sha256}`).join('\n')))
  const deploymentRevision = frontend.payload.deployment_revision_sha256
  const digestBody = { environment_fingerprint_sha256: environmentFingerprint, deployment_revision_sha256: deploymentRevision, edge_aggregate_sha256: edgeAggregate }
  const deploymentDigest = sha256(Buffer.from(JSON.stringify(stable({ schema: 'aurora-checkin-deployment-digest', schema_version: 1, ...digestBody }))))
  return {
    observation: { schema: 'aurora-checkin-readonly-deployment-observation', schema_version: 2, observation_id: `OBS-CHECKIN-WORKFLOW-${frontend.observed_at.replace(/[-:.TZ]/g, '')}`,
      sources, target: { environment: 'aurora-test', target_id: 'aurora-test', environment_fingerprint_sha256: environmentFingerprint },
      edge: { functions, aggregate_sha256: edgeAggregate }, deployment: { revision_sha256: deploymentRevision, deployment_digest_sha256: deploymentDigest },
      timing: { observed_from: frontend.observed_at, observed_until: edge.observed_at },
      effects: { remote_writes: 0, deployments: 0, workflow_runs: 0, database_mutations: 0, edge_mutations: 0, submit_or_webhook_calls: 0, secret_reads: 0, temp_objects: 0 } },
    digestBytes: Buffer.from(JSON.stringify(stable({ schema: 'aurora-checkin-deployment-digest', schema_version: 1, ...digestBody }))),
  }
}
