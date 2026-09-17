import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { DirectCheckinButton } from './Checkin'
import { CHECKIN_ADDRESS } from '@/lib/deployment'
const mocks = vi.hoisted(() => ({
  address: '0x1111111111111111111111111111111111111111' as string | undefined,
  eligible: true, paused: false, chain: 204,
  send: vi.fn(), receipt: vi.fn(), switch: vi.fn(), estimate: vi.fn(), track: vi.fn(),
}))
vi.mock('@/lib/analytics', () => ({ track: mocks.track }))
vi.mock('@/components/WalletWait', () => ({
  WalletLaneBusyError: class extends Error {},
  useWalletWait: () => ({ wait: (fn: () => Promise<unknown>) => fn() }),
  requestWallet: (_: unknown, fn: () => Promise<unknown>) => fn(),
}))
vi.mock('wagmi', () => ({
  useAccount: () => ({ address: mocks.address, chainId: mocks.chain }),
  useConnect: () => ({ connectors: [], connectAsync: vi.fn() }),
  useDisconnect: () => ({ disconnect: vi.fn() }),
  usePublicClient: () => ({ estimateGas: mocks.estimate, waitForTransactionReceipt: mocks.receipt }),
  useSendTransaction: () => ({ sendTransactionAsync: mocks.send }),
  useSwitchChain: () => ({ switchChainAsync: mocks.switch }),
  useReadContract: ({ functionName }: { functionName: string }) => {
    const data = ({ currentDay: 20712n, totalUsers: 50n, totalCheckIns: 100n, dailyStats: [10n, 100n],
      canCheckIn: mocks.eligible, paused: mocks.paused, users: [20711n, 2n, 4n, 8n, 80n, 80n],
    } as Record<string, unknown>)[functionName]
    return { data, isError: false, refetch: async () => ({ data }) }
  },
}))
beforeEach(() => {
  vi.clearAllMocks()
  mocks.address = '0x1111111111111111111111111111111111111111'
  mocks.eligible = true; mocks.paused = false; mocks.chain = 204
  mocks.send.mockResolvedValue('0x' + 'a'.repeat(64))
  mocks.receipt.mockResolvedValue({ status: 'success' })
  mocks.estimate.mockResolvedValue(100000n)
  mocks.switch.mockResolvedValue({ id: 204 })
})
afterEach(cleanup)
describe('community check-in transaction boundary', () => {
  it('sends zero value only to the published opBNB contract and tracks a confirmed receipt', async () => {
    render(<DirectCheckinButton />)
    fireEvent.click(screen.getByRole('button', { name: 'Count me in today' }))
    await screen.findByText('Your participation is recorded. Thank you for showing up.')
    expect(mocks.send).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ to: CHECKIN_ADDRESS, chainId: 204, value: 0n }))
    expect(mocks.track.mock.calls).toEqual([['checkin_submit'], ['checkin_confirm']])
  })
  it('does not count a reverted receipt as confirmation', async () => {
    mocks.receipt.mockResolvedValue({ status: 'reverted' })
    render(<DirectCheckinButton />)
    fireEvent.click(screen.getByRole('button', { name: 'Count me in today' }))
    await screen.findByText(/Check-in reverted/)
    expect(mocks.track).not.toHaveBeenCalledWith('checkin_confirm')
  })
  it('rechecks an unknown receipt without submitting a second transaction', async () => {
    mocks.receipt.mockRejectedValueOnce(new Error('timeout'))
    render(<DirectCheckinButton />)
    fireEvent.click(screen.getByRole('button', { name: 'Count me in today' }))
    await screen.findByText(/Confirmation is still unknown/)
    fireEvent.click(screen.getByRole('button', { name: 'Check transaction status' }))
    await screen.findByText('Your participation is recorded. Thank you for showing up.')
    expect(mocks.send).toHaveBeenCalledTimes(1)
    expect(mocks.track.mock.calls).toEqual([['checkin_submit'], ['checkin_confirm']])
  })
  it.each(['paused', 'done'])('prevents transactions when %s', async state => {
    mocks.paused = state === 'paused'; mocks.eligible = state !== 'done'
    render(<DirectCheckinButton />)
    const button = screen.getByRole('button', { name: state === 'paused' ? 'Participation paused' : 'You’re counted today' }) as HTMLButtonElement
    expect(button.disabled).toBe(true)
    fireEvent.click(button)
    expect(mocks.send).not.toHaveBeenCalled()
  })
  it('does not send when a network switch is refused', async () => {
    mocks.chain = 56; mocks.switch.mockRejectedValueOnce(new Error('User refused'))
    render(<DirectCheckinButton />)
    fireEvent.click(screen.getByRole('button', { name: 'Count me in today' }))
    await waitFor(() => expect(mocks.switch).toHaveBeenCalled())
    await screen.findByText(/Unable to check in/)
    expect(mocks.send).not.toHaveBeenCalled()
  })
})
