import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  REQUIRED_CHECKIN_CLAIMS,
  buildReleaseManifest,
  scanSourceContracts,
  serializeManifest,
  sha256,
  validateProducerContract,
  validateReleaseManifest,
} from './release-manifest-lib.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const contract = JSON.parse(fs.readFileSync(path.join(root, 'release/component-manifest.contract.json'), 'utf8'))
const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'))
const walk = (directory) => fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
  const absolute = path.join(directory, entry.name)
  if (entry.isDirectory()) return entry.name === 'test' ? [] : walk(absolute)
  if (!/\.[jt]sx?$/.test(entry.name) || /\.(?:test|spec|stories)\.[jt]sx?$/.test(entry.name)) return []
  const relative = path.relative(root, absolute).replaceAll('\\', '/')
  return [{ path: relative, bytes: fs.readFileSync(absolute), text: fs.readFileSync(absolute, 'utf8') }]
})
const sources = walk(path.join(root, 'src')).sort((left, right) => left.path.localeCompare(right.path, 'en'))
const actualContracts = scanSourceContracts(sources)
const d = (char) => char.repeat(64)
const s = (char) => char.repeat(40)
const context = (overrides = {}) => ({
  git: { branch: 'main', commit_sha: s('a'), tree_sha: s('b'), committed_at: '2026-08-17T12:00:00+02:00', clean: true },
  trackedFiles: 100,
  sourceFiles: sources,
  exporterFiles: [{ path: 'tools/export-release-manifest.mjs', sha256: d('c') }, { path: 'tools/release-manifest-lib.mjs', sha256: d('d') }],
  contract,
  contractSha256: d('e'),
  packageJson,
  actualContracts,
  ...overrides,
})

describe('source-owned Check-in-Release-Komponentenmanifest', () => {
  it('bindet den deklarativen Vertrag exakt an die aktuellen Quellen und sieben Claims', () => {
    expect(validateProducerContract(contract, { packageJson, actualContracts })).toEqual([])
    expect(contract.affected_claim_ids).toEqual(REQUIRED_CHECKIN_CLAIMS)
    expect(actualContracts).toEqual(contract.expected_contracts)
  })

  it('erzeugt fuer identischen Input bytegleiches, sanitisiertes JSON', () => {
    const first = buildReleaseManifest(context())
    const second = buildReleaseManifest(context())
    expect(serializeManifest(first)).toBe(serializeManifest(second))
    expect(validateReleaseManifest(first, { git: context().git })).toEqual([])
    expect(sha256(serializeManifest(first))).toMatch(/^[a-f0-9]{64}$/)
    expect(serializeManifest(first)).not.toMatch(/https?:\/\/|Bearer\s+|password=|secret=|api[_-]?key=|token=/i)
  })

  it('verwirft Claim-, Quellen- und unbekannte Vertragsdrift', () => {
    const changed = structuredClone(contract)
    changed.affected_claim_ids.pop()
    changed.expected_contracts.routes.pop()
    changed.manual_approval = true
    expect(validateProducerContract(changed, { packageJson, actualContracts })).toEqual([
      'Producervertrag ist ungueltig oder enthaelt unbekannte Felder.',
    ])
    delete changed.manual_approval
    expect(validateProducerContract(changed, { packageJson, actualContracts })).toEqual(expect.arrayContaining([
      'Betroffene zentrale Check-in-Claims sind unvollstaendig, doppelt oder unsortiert.',
      'routes driftet gegen die Check-in-Quellen.',
    ]))
  })

  it('verwirft dirty oder fremde Revisionen und manipulierte Schnittstellenfingerprints', () => {
    const dirty = buildReleaseManifest(context({ git: { ...context().git, clean: false } }))
    const foreign = { ...context().git, commit_sha: s('f') }
    dirty.contracts.interface_fingerprint_sha256 = d('0')
    dirty.component.manual_approval = true
    const errors = validateReleaseManifest(dirty, { git: foreign })
    expect(errors).toEqual(expect.arrayContaining([
      'Source-Bindung ist dirty, fremd oder unvollstaendig.',
      'Source-Revision driftet gegen den Checkout.',
      'Komponentenvertrag ist ungueltig oder enthaelt unbekannte Felder.',
      'Schnittstellenfingerprint driftet.',
    ]))
  })

  it('haelt Build, Test, Edge und Deployment als separate Pflichtnachweise offen', () => {
    const manifest = buildReleaseManifest(context())
    expect(manifest.release_requirements).toEqual(expect.objectContaining({
      build_evidence_required: true,
      test_evidence_required: true,
      skips_must_be_empty: true,
      edge_revision_required: true,
      deployment_digest_required: true,
      deployment_attestation_required: true,
    }))
  })
})
