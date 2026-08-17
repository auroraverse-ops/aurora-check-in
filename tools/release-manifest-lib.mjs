import crypto from 'node:crypto'

export const REQUIRED_CHECKIN_CLAIMS = Object.freeze([
  'RISK-CHECKIN-CONFIG-PUBLIC-SANITIZED',
  'RISK-CHECKIN-HMAC-REPLAY-ONCE',
  'RISK-CHECKIN-IP-POLICY-ENFORCED',
  'RISK-CHECKIN-MUTATION-IDEMPOTENT',
  'RISK-CHECKIN-SUBMIT-AUTH-REPLAY-BOUND',
  'RISK-SURFACE-CHECKIN-EVIDENCE-COMPLETE',
  'RISK-SURFACE-CHECKIN-INVENTORY-COMPLETE',
])

export const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex')
export const stable = (value) => Array.isArray(value)
  ? value.map(stable)
  : value && typeof value === 'object'
    ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]))
    : value
export const serializeManifest = (manifest) => `${JSON.stringify(stable(manifest), null, 2)}\n`

const object = (value) => value && typeof value === 'object' && !Array.isArray(value)
const sorted = (values) => [...values].sort((left, right) => left.localeCompare(right, 'en'))
const same = (left, right) => JSON.stringify(left) === JSON.stringify(right)
const sameSet = (left, right) => Array.isArray(left) && Array.isArray(right) && same(sorted(left), sorted(right))
const exactKeys = (value, keys) => object(value) && sameSet(Object.keys(value), keys)
const digest = (value) => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value)
const gitSha = (value) => typeof value === 'string' && /^[a-f0-9]{40}$/.test(value)
const cleanMetadata = (value) => !/https?:\/\/|Bearer\s+|password=|secret=|api[_-]?key=|token=/i.test(JSON.stringify(value))
const uniqueSorted = (values) => sorted([...new Set(values)])
const lineMaskComments = (source) => source
  .replace(/\/\*[\s\S]*?\*\//g, (match) => match.replace(/[^\n]/g, ' '))
  .replace(/\/\/[^\n]*/g, (match) => ' '.repeat(match.length))

const balancedObject = (source, start) => {
  let depth = 0
  let quote = null
  for (let index = start; index < source.length; index += 1) {
    const char = source[index]
    const previous = source[index - 1]
    if (quote) {
      if (char === quote && previous !== '\\') quote = null
      continue
    }
    if (char === '"' || char === "'" || char === '`') { quote = char; continue }
    if (char === '{') depth += 1
    if (char === '}' && --depth === 0) return source.slice(start, index + 1)
  }
  return null
}

const topLevelZodFields = (source) => {
  const fields = []
  let curly = 0
  let paren = 0
  let bracket = 0
  let quote = null
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index]
    const previous = source[index - 1]
    if (quote) {
      if (char === quote && previous !== '\\') quote = null
      continue
    }
    if (char === '"' || char === "'" || char === '`') { quote = char; continue }
    if (char === '{') curly += 1
    else if (char === '}') curly -= 1
    else if (char === '(') paren += 1
    else if (char === ')') paren -= 1
    else if (char === '[') bracket += 1
    else if (char === ']') bracket -= 1
    if ((char !== '{' && char !== ',') || curly !== 1 || paren !== 0 || bracket !== 0) continue
    const match = source.slice(index + 1).match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*:\s*z\./)
    if (match) fields.push(match[1])
  }
  return fields
}

export function scanSourceContracts(sourceFiles) {
  const joined = sourceFiles.map((entry) => entry.text).join('\n')
  const routes = uniqueSorted([...joined.matchAll(/<Route\b[\s\S]*?\bpath\s*=\s*['"]([^'"]+)['"][\s\S]*?(?:\/>|>)/g)].map((match) => match[1]))
  const environment_interfaces = uniqueSorted([...joined.matchAll(/import\.meta\.env\.([A-Z][A-Z0-9_]*)/g)].map((match) => match[1]))
  const edge_function_paths = uniqueSorted([...joined.matchAll(/\/functions\/v1\/([a-z0-9-]+)/gi)].map((match) => match[1]))
  const request_headers = uniqueSorted([...joined.matchAll(/['"]([A-Za-z][A-Za-z0-9-]+)['"]\s*:/g)].map((match) => match[1]).filter((name) => /^(?:content-type|authorization|x-)/i.test(name)))
  const formFields = []
  const masked = lineMaskComments(joined)
  for (const match of masked.matchAll(/\bz\.object\(\s*\{/g)) {
    const value = balancedObject(masked, match.index + match[0].lastIndexOf('{'))
    if (value) formFields.push(...topLevelZodFields(value))
  }
  const consent_contracts = [...joined.matchAll(/([A-Za-z_][A-Za-z0-9_]*)\s*:\s*\{\s*version\s*:\s*['"]([^'"]+)['"]\s*,\s*text\s*:\s*['"]([^'"]+)['"]/g)]
    .map((match) => ({ key: match[1], version: match[2], text_sha256: sha256(match[3]) }))
    .sort((left, right) => left.key.localeCompare(right.key, 'en'))
  const signals = []
  if (/safeRandomUUID\s*\(|\brequest_id\b/.test(joined)) signals.push('idempotency_request_id')
  if (/X-Checkin-Token/i.test(joined)) signals.push('checkin_token_header')
  if (/crypto\.subtle\.digest\(\s*['"]SHA-256['"]/.test(joined)) signals.push('sha256_consent_or_integrity')
  if (/CONSENT_HASH_UNAVAILABLE|no-subtle-crypto/.test(joined)) signals.push('consent_hash_unavailable_sentinel')
  if (/VITE_N8N_WEBHOOK_URL/.test(joined)) signals.push('legacy_direct_webhook_interface')
  if (/\bsubmit_url\b/.test(joined) && /fetch\(submitUrl/.test(joined)) signals.push('runtime_submit_url_contract')
  return {
    routes,
    environment_interfaces,
    edge_function_paths,
    request_headers,
    form_schema_fields: uniqueSorted(formFields),
    contract_signals: uniqueSorted(signals),
    consent_contracts,
  }
}

export function validateProducerContract(contract, context = {}) {
  const errors = []
  const topKeys = ['schema', 'schema_version', 'unit', 'api_contract_version', 'build_command', 'test_command', 'affected_claim_ids', 'expected_contracts', 'release_requirements']
  if (!exactKeys(contract, topKeys)) return ['Producervertrag ist ungueltig oder enthaelt unbekannte Felder.']
  if (contract.schema !== 'aurora-check-in-release-producer-contract' || contract.schema_version !== 1 || contract.unit !== 'aurora-check-in') errors.push('Producervertrag hat eine fremde Identitaet.')
  if (!/^[a-z0-9][a-z0-9-]{2,79}$/.test(contract.api_contract_version ?? '')) errors.push('API-Vertragsversion ist ungueltig.')
  if (!same(contract.affected_claim_ids, REQUIRED_CHECKIN_CLAIMS)) errors.push('Betroffene zentrale Check-in-Claims sind unvollstaendig, doppelt oder unsortiert.')
  for (const [field, prefix] of [['build_command', 'npm run '], ['test_command', 'npm run ']]) {
    const command = contract[field]
    const script = typeof command === 'string' && command.startsWith(prefix) ? command.slice(prefix.length) : null
    if (!script || !context.packageJson?.scripts?.[script]) errors.push(`${field} ist nicht im Root-Package gebunden.`)
  }
  const expectedKeys = ['routes', 'environment_interfaces', 'edge_function_paths', 'request_headers', 'form_schema_fields', 'contract_signals', 'consent_contracts']
  if (!exactKeys(contract.expected_contracts, expectedKeys)) errors.push('Erwartete Schnittstellen sind unvollstaendig oder enthalten unbekannte Felder.')
  else {
    for (const key of expectedKeys.filter((key) => key !== 'consent_contracts')) {
      const values = contract.expected_contracts[key]
      if (!Array.isArray(values) || !same(values, uniqueSorted(values))) errors.push(`${key} ist doppelt oder unsortiert.`)
      if (context.actualContracts && !same(values, context.actualContracts[key])) errors.push(`${key} driftet gegen die Check-in-Quellen.`)
    }
    const consents = contract.expected_contracts.consent_contracts
    if (!Array.isArray(consents) || consents.some((entry) => !entry.key || !entry.version || !digest(entry.text_sha256))) errors.push('Consent-Vertraege sind ungueltig.')
    if (context.actualContracts && !same(consents, context.actualContracts.consent_contracts)) errors.push('consent_contracts driftet gegen die Check-in-Quellen.')
  }
  const requirementKeys = ['clean_repository_required', 'build_evidence_required', 'test_evidence_required', 'skips_must_be_empty', 'artifact_digest_required', 'evidence_timestamp_required', 'edge_revision_required', 'deployment_digest_required', 'deployment_attestation_required']
  if (!exactKeys(contract.release_requirements, requirementKeys) || requirementKeys.some((key) => contract.release_requirements[key] !== true)) errors.push('Release-Anforderungen sind unvollstaendig oder fail-open.')
  if (!cleanMetadata(contract)) errors.push('Producervertrag enthaelt URL-, Credential- oder Secretwerte.')
  return errors
}

export function buildReleaseManifest(context) {
  const sourceDigests = context.sourceFiles.map((entry) => ({ path: entry.path, sha256: sha256(entry.bytes) }))
    .sort((left, right) => left.path.localeCompare(right.path, 'en'))
  const contracts = { ...context.actualContracts, api_contract_version: context.contract.api_contract_version }
  contracts.interface_fingerprint_sha256 = sha256(JSON.stringify(stable(contracts)))
  return {
    schema: 'aurora-check-in-release-component-manifest',
    schema_version: 1,
    unit: 'aurora-check-in',
    source: {
      repository: 'aurora-check-in',
      branch: context.git.branch,
      commit_sha: context.git.commit_sha,
      tree_sha: context.git.tree_sha,
      committed_at: context.git.committed_at,
      clean: context.git.clean,
      tracked_files: context.trackedFiles,
      production_source_files: sourceDigests.length,
      aggregate_sha256: sha256(sourceDigests.map((entry) => `${entry.path}\0${entry.sha256}`).join('\n')),
    },
    producer: {
      command_id: 'npm run release:manifest',
      contract_path: 'release/component-manifest.contract.json',
      contract_sha256: context.contractSha256,
      exporter_files: context.exporterFiles,
      exporter_aggregate_sha256: sha256(context.exporterFiles.map((entry) => `${entry.path}\0${entry.sha256}`).join('\n')),
    },
    component: {
      package_name: context.packageJson.name,
      package_version: context.packageJson.version,
      build_command: context.contract.build_command,
      test_command: context.contract.test_command,
    },
    contracts,
    affected_claim_ids: context.contract.affected_claim_ids,
    release_requirements: context.contract.release_requirements,
  }
}

export function validateReleaseManifest(manifest, context = {}) {
  const errors = []
  if (!exactKeys(manifest, ['schema', 'schema_version', 'unit', 'source', 'producer', 'component', 'contracts', 'affected_claim_ids', 'release_requirements'])) return ['Release-Komponentenmanifest ist ungueltig oder enthaelt unbekannte Felder.']
  if (manifest.schema !== 'aurora-check-in-release-component-manifest' || manifest.schema_version !== 1 || manifest.unit !== 'aurora-check-in') errors.push('Release-Komponentenmanifest hat eine fremde Identitaet.')
  if (!exactKeys(manifest.source, ['repository', 'branch', 'commit_sha', 'tree_sha', 'committed_at', 'clean', 'tracked_files', 'production_source_files', 'aggregate_sha256']) || manifest.source.repository !== 'aurora-check-in' || manifest.source.clean !== true || !gitSha(manifest.source.commit_sha) || !gitSha(manifest.source.tree_sha) || Number.isNaN(Date.parse(manifest.source.committed_at)) || !Number.isInteger(manifest.source.tracked_files) || !Number.isInteger(manifest.source.production_source_files) || !digest(manifest.source.aggregate_sha256)) errors.push('Source-Bindung ist dirty, fremd oder unvollstaendig.')
  if (context.git && (manifest.source.branch !== context.git.branch || manifest.source.commit_sha !== context.git.commit_sha || manifest.source.tree_sha !== context.git.tree_sha)) errors.push('Source-Revision driftet gegen den Checkout.')
  const producerFilesValid = Array.isArray(manifest.producer?.exporter_files)
    && manifest.producer.exporter_files.length > 0
    && manifest.producer.exporter_files.every((entry) => exactKeys(entry, ['path', 'sha256']) && typeof entry.path === 'string' && digest(entry.sha256))
    && same(manifest.producer.exporter_files.map((entry) => entry.path), sorted(manifest.producer.exporter_files.map((entry) => entry.path)))
  const producerAggregate = producerFilesValid ? sha256(manifest.producer.exporter_files.map((entry) => `${entry.path}\0${entry.sha256}`).join('\n')) : null
  if (!exactKeys(manifest.producer, ['command_id', 'contract_path', 'contract_sha256', 'exporter_files', 'exporter_aggregate_sha256']) || manifest.producer.command_id !== 'npm run release:manifest' || manifest.producer.contract_path !== 'release/component-manifest.contract.json' || !digest(manifest.producer.contract_sha256) || !producerFilesValid || manifest.producer.exporter_aggregate_sha256 !== producerAggregate) errors.push('Producer-Bindung ist ungueltig.')
  if (!exactKeys(manifest.component, ['package_name', 'package_version', 'build_command', 'test_command']) || !manifest.component.package_name || !manifest.component.package_version || !/^npm run [a-z0-9:-]+$/.test(manifest.component.build_command ?? '') || !/^npm run [a-z0-9:-]+$/.test(manifest.component.test_command ?? '')) errors.push('Komponentenvertrag ist ungueltig oder enthaelt unbekannte Felder.')
  if (!same(manifest.affected_claim_ids, REQUIRED_CHECKIN_CLAIMS)) errors.push('Claim-Bindung ist unvollstaendig oder driftet.')
  const contractKeys = ['api_contract_version', 'routes', 'environment_interfaces', 'edge_function_paths', 'request_headers', 'form_schema_fields', 'contract_signals', 'consent_contracts', 'interface_fingerprint_sha256']
  const contractArraysValid = object(manifest.contracts) && ['routes', 'environment_interfaces', 'edge_function_paths', 'request_headers', 'form_schema_fields', 'contract_signals']
    .every((key) => Array.isArray(manifest.contracts[key]) && same(manifest.contracts[key], uniqueSorted(manifest.contracts[key])))
  const consentContractsValid = Array.isArray(manifest.contracts?.consent_contracts) && manifest.contracts.consent_contracts.every((entry) => exactKeys(entry, ['key', 'version', 'text_sha256']) && entry.key && entry.version && digest(entry.text_sha256))
  if (!exactKeys(manifest.contracts, contractKeys) || !contractArraysValid || !consentContractsValid || !digest(manifest.contracts.interface_fingerprint_sha256)) errors.push('Schnittstellenvertrag ist ungueltig oder enthaelt unbekannte Felder.')
  else {
    const { interface_fingerprint_sha256, ...contracts } = manifest.contracts
    if (sha256(JSON.stringify(stable(contracts))) !== interface_fingerprint_sha256) errors.push('Schnittstellenfingerprint driftet.')
  }
  const requirementKeys = ['clean_repository_required', 'build_evidence_required', 'test_evidence_required', 'skips_must_be_empty', 'artifact_digest_required', 'evidence_timestamp_required', 'edge_revision_required', 'deployment_digest_required', 'deployment_attestation_required']
  if (!exactKeys(manifest.release_requirements, requirementKeys) || requirementKeys.some((key) => manifest.release_requirements[key] !== true)) errors.push('Release-Anforderungen sind unvollstaendig oder fail-open.')
  if (!cleanMetadata(manifest)) errors.push('Manifest enthaelt URL-, Credential- oder Secretwerte.')
  return errors
}
