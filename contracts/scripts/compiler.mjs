import { createHash, randomUUID } from 'node:crypto'
import { readFile, mkdir, writeFile, rename, rm } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'

// Pinned against https://binaries.soliditylang.org/emscripten-wasm32/list.json.
const VERSION = '0.8.36+commit.8a079791'
const SHA256 = '704877a592467d7de651ec5377ea6e3c676ae71d31f325401957d41bedfaa0d8'
const compilerUrl = `https://binaries.soliditylang.org/emscripten-wasm32/solc-emscripten-wasm32-v${VERSION}.js`
const cacheDir = new URL('../.cache/solc/', import.meta.url)
const cacheFile = new URL(`soljson-${SHA256}.cjs`, cacheDir)

function verify(bytes) {
  assert.equal(createHash('sha256').update(bytes).digest('hex'), SHA256,
    'Solidity WASM checksum mismatch. Refusing to execute the compiler; remove contracts/.cache and retry.')
}

export async function loadCompiler() {
  let bytes
  try { bytes = await readFile(cacheFile) }
  catch (error) {
    if (error.code !== 'ENOENT') throw error
    console.log(`Downloading official Solidity WASM ${VERSION}…`)
    const response = await fetch(compilerUrl, { signal: AbortSignal.timeout(30_000) })
    assert.ok(response.ok, `Compiler download failed: HTTP ${response.status}`)
    bytes = Buffer.from(await response.arrayBuffer())
    verify(bytes)
    await mkdir(cacheDir, { recursive: true })
    const temporary = new URL(`${randomUUID()}.tmp`, cacheDir)
    try {
      await writeFile(temporary, bytes, { flag: 'wx' })
      await rename(temporary, cacheFile)
    } finally { await rm(temporary, { force: true }) }
  }
  // Check cached files too, before loading executable code.
  verify(bytes)
  const soljson = createRequire(import.meta.url)(fileURLToPath(cacheFile))
  const version = soljson.cwrap('solidity_version', 'string', [])
  assert.equal(version().split('.Emscripten')[0], VERSION, 'Compiler version drift')
  const compile = soljson.cwrap('solidity_compile', 'string', ['string', 'number', 'number'])
  const reset = soljson.cwrap('solidity_reset', null, [])
  return {
    version,
    compile(input) {
      // The standard input embeds every source; no filesystem/import callback is needed.
      try { return compile(input, 0, 0) }
      finally { reset() }
    },
  }
}
