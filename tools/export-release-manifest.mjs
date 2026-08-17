#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import {
  buildReleaseManifest,
  scanSourceContracts,
  serializeManifest,
  sha256,
  validateProducerContract,
  validateReleaseManifest,
} from './release-manifest-lib.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const relative = (value) => value.replaceAll('\\', '/')
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim()
const argument = (name) => { const index = process.argv.indexOf(name); return index >= 0 ? process.argv[index + 1] : null }
const outputRelative = relative(argument('--output') ?? '.release-artifacts/component-manifest.json')
if (path.isAbsolute(outputRelative) || outputRelative.split('/').includes('..')) {
  console.error('FAIL release manifest: Ausgabepfad muss sicher und repository-relativ sein.')
  process.exit(2)
}

const contractPath = 'release/component-manifest.contract.json'
const exporterPaths = ['tools/export-release-manifest.mjs', 'tools/release-manifest-lib.mjs']
const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'))
const contractBytes = fs.readFileSync(path.join(root, contractPath))
const contract = JSON.parse(contractBytes.toString('utf8'))
const tracked = execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8' }).split('\0').filter(Boolean).map(relative).sort((left, right) => left.localeCompare(right, 'en'))
const productionPaths = tracked.filter((entry) => /^src\/.*\.[cm]?[jt]sx?$/.test(entry) && !/(^|\/)(?:test|tests|__tests__|mocks?|fixtures?)(\/|$)/.test(entry) && !/\.(?:test|spec|stories)\.[cm]?[jt]sx?$/.test(entry))
const sourceFiles = productionPaths.map((entry) => ({ path: entry, bytes: fs.readFileSync(path.join(root, entry)), text: fs.readFileSync(path.join(root, entry), 'utf8') }))
const actualContracts = scanSourceContracts(sourceFiles)
const contractErrors = validateProducerContract(contract, { packageJson, actualContracts })
if (contractErrors.length) {
  console.error(`FAIL release manifest producer contract: ${contractErrors.join(' | ')}`)
  process.exit(1)
}
if (process.argv.includes('--validate-contract')) {
  console.log(`PASS release manifest producer contract: sources=${sourceFiles.length} claims=${contract.affected_claim_ids.length}.`)
  process.exit(0)
}

const dirty = git('status', '--porcelain', '--untracked-files=all') !== ''
if (dirty) {
  console.error('FAIL release manifest: Check-in-Checkout ist nicht sauber; keine Releaseidentitaet erzeugt.')
  process.exit(2)
}
const gitContext = {
  branch: git('branch', '--show-current'),
  commit_sha: git('rev-parse', 'HEAD'),
  tree_sha: git('rev-parse', 'HEAD^{tree}'),
  committed_at: git('log', '-1', '--format=%cI'),
  clean: true,
}
const exporterFiles = exporterPaths.map((entry) => ({ path: entry, sha256: sha256(fs.readFileSync(path.join(root, entry))) }))
const manifest = buildReleaseManifest({
  git: gitContext,
  trackedFiles: tracked.length,
  sourceFiles,
  exporterFiles,
  contract,
  contractSha256: sha256(contractBytes),
  packageJson,
  actualContracts,
})
const manifestErrors = validateReleaseManifest(manifest, { git: gitContext })
if (manifestErrors.length) {
  console.error(`FAIL release manifest: ${manifestErrors.join(' | ')}`)
  process.exit(1)
}
const serialized = serializeManifest(manifest)
const outputPath = path.join(root, outputRelative)
if (process.argv.includes('--check')) {
  if (!fs.existsSync(outputPath) || fs.readFileSync(outputPath, 'utf8') !== serialized) {
    console.error(`FAIL release manifest: ${outputRelative} fehlt oder driftet.`)
    process.exit(1)
  }
  console.log(`PASS release manifest artifact: commit=${manifest.source.commit_sha.slice(0, 12)} digest=${sha256(serialized).slice(0, 12)}.`)
} else {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true })
  fs.writeFileSync(outputPath, serialized)
  console.log(`WRITE release manifest artifact: commit=${manifest.source.commit_sha.slice(0, 12)} digest=${sha256(serialized).slice(0, 12)}.`)
}
