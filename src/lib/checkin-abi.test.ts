import { describe, expect, it } from 'vitest'
import { COMMUNITY_CHECKIN_ABI } from './checkin-abi'
import explorer from '../../contracts/verification/explorer-result.json'

// Ignore compiler annotations and explorer-cached values, not ABI signatures or outputs.
function schema(value: unknown): unknown {
  return JSON.parse(JSON.stringify(value, (key, item) =>
    key === 'internalType' || key === 'value' ? undefined : item))
}

describe('frontend ABI matches the verified contract', () => {
  it.each(COMMUNITY_CHECKIN_ABI)('$name', entry => {
    const verified = explorer.ouput_json.abi.find(candidate =>
      candidate.type === entry.type && 'name' in candidate && candidate.name === entry.name)
    expect(verified, `Missing verified ABI entry: ${entry.name}`).toBeDefined()
    expect(schema(entry)).toEqual(schema(verified))
  })
})
