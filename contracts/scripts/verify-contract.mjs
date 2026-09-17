import fs from 'node:fs'
import assert from 'node:assert/strict'
import { loadCompiler } from './compiler.mjs'
const solc = await loadCompiler()
const read = path => JSON.parse(fs.readFileSync(new URL(path, import.meta.url), 'utf8'))
const input = read('../verification/standard-input.json')
const explorer = read('../verification/explorer-result.json')
const deployment = read('../verification/deployment.json')
const saved = explorer.ouput_json
assert.equal(`v${solc.version().split('.Emscripten')[0]}`, deployment.compiler, 'Compiler version drift')
assert.equal(fs.readFileSync(new URL('../MPCCheckinCore.sol', import.meta.url), 'utf8'),
  input.sources['contracts/MPCCheckinCore.sol'].content, 'Readable source differs from verified compiler input')
const output = JSON.parse(solc.compile(JSON.stringify(input)))
const errors = output.errors?.filter(error => error.severity === 'error') ?? []
assert.equal(errors.length, 0, JSON.stringify(errors))
const built = output.contracts['contracts/MPCCheckinCore.sol'].MPCCheckinCore
const hex = value => value.replace(/^0x/, '').toLowerCase()
assert.equal(built.evm.deployedBytecode.object, hex(saved.bytecode), 'Runtime bytecode mismatch')
assert.equal(built.evm.bytecode.object, hex(saved.creationCode), 'Creation bytecode mismatch')
// The explorer decorates view outputs with cached `value` fields; these are not ABI schema.
const explorerAbi = JSON.parse(JSON.stringify(saved.abi, (key, value) => key === 'value' ? undefined : value))
assert.deepEqual(built.abi, explorerAbi, 'ABI mismatch')
console.log('PASS: exact compiler, source, ABI, creation and runtime bytecode match the verified deployment artifact.')
if (process.argv.includes('--live')) {
  const response = await fetch('https://opbnb-mainnet-rpc.bnbchain.org', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_getCode', params: [deployment.address, 'latest'] }),
    signal: AbortSignal.timeout(20_000),
  })
  assert.ok(response.ok, `RPC HTTP ${response.status}`)
  const result = await response.json()
  assert.ok(!result.error && result.result, JSON.stringify(result.error))
  assert.equal(hex(result.result), built.evm.deployedBytecode.object, 'Live runtime mismatch')
  console.log(`PASS: live opBNB runtime matches ${deployment.address}.`)
}
