'use client'

import { useEffect, useRef, useState } from 'react'
import { BaseError, encodeFunctionData, type Address, type Hash } from 'viem'
import { useAccount, useConnect, useDisconnect, usePublicClient, useReadContract, useSendTransaction, useSwitchChain } from 'wagmi'
import type { Connector } from 'wagmi'
import { opBNB as OPBNB_CHAIN } from 'viem/chains'
import { CHECKIN_ADDRESS } from '@/lib/deployment'
import { track } from '@/lib/analytics'
import { requestWallet, useWalletWait, WalletLaneBusyError } from '@/components/WalletWait'
import { Button } from '@/components/Button'
import { COMMUNITY_CHECKIN_ABI as ABI } from '@/lib/checkin-abi'

const contract = { address: CHECKIN_ADDRESS, abi: ABI, chainId: OPBNB_CHAIN.id } as const
const number = (value: bigint | undefined) => value === undefined ? '—' : value.toLocaleString('en-US')
const checkInData = encodeFunctionData({ abi: ABI, functionName: 'checkIn' })

function RetryLine({ label, onRetry }: { label: string; onRetry: () => void }) {
  return <button type="button" onClick={onRetry} className="cursor-pointer text-xs text-destructive underline">{label}</button>
}


export function DirectCheckinButton({ allowDisconnect = true, onBusyChange }: { allowDisconnect?: boolean; onBusyChange?: (busy: boolean) => void }) {
  return <CommunityCard allowDisconnect={allowDisconnect} onBusyChange={onBusyChange} />
}

function CommunityCard({ allowDisconnect, onBusyChange }: { allowDisconnect: boolean; onBusyChange?: (busy: boolean) => void }) {
  const { address } = useAccount()
  const [refresh, setRefresh] = useState(0)
  return (
    <section aria-labelledby="community-heading" className="w-full max-w-lg rounded-lg border border-border bg-surface/80 p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <p className="font-mono text-[10px] tracking-widest text-copper uppercase">Community participation</p>
        <span className="rounded-sm border border-border px-2 py-1 font-mono text-[10px] text-muted-foreground">opBNB</span>
      </div>
      <h2 id="community-heading" className="mt-3 font-display text-xl font-medium text-foreground">Show up for MPC.</h2>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Record your daily participation in the MPC community.</p>
      <CommunityStats refresh={refresh} />
      <div className="border-t border-border pt-4">
        <p className="mb-4 text-xs leading-relaxed text-muted-foreground">Anyone can participate—no sign-up required.</p>
        {address ? <ConnectedCheckin key={address} address={address} allowDisconnect={allowDisconnect} onBusyChange={onBusyChange} onConfirmed={() => setRefresh((v) => v + 1)} /> : <ConnectCommunityWallet />}
        <p className="mt-3 text-center text-xs leading-relaxed text-muted-foreground">Once per day · Resets at 00:00 UTC<br />Gas fees apply in opBNB BNB. No token or monetary rewards currently.</p>
      </div>
    </section>
  )
}

function CommunityStats({ refresh }: { refresh: number }) {
  const poll = { refetchInterval: 30_000, staleTime: 15_000, refetchOnMount: 'always' as const }
  const today = useReadContract({ ...contract, functionName: 'currentDay', query: poll })
  const wallets = useReadContract({ ...contract, functionName: 'totalUsers', query: poll })
  const participations = useReadContract({ ...contract, functionName: 'totalCheckIns', query: poll })
  const day = today.data
  const daily = useReadContract({ ...contract, functionName: 'dailyStats', args: [day ?? 0n],
    query: { ...poll, enabled: day !== undefined } })
  const unavailable = today.isError || wallets.isError || participations.isError || daily.isError
  const refetchToday = today.refetch
  const refetchWallets = wallets.refetch
  const refetchParticipations = participations.refetch
  const refetchDaily = daily.refetch
  const refreshed = useRef(refresh)
  useEffect(() => {
    if (refreshed.current === refresh) return
    refreshed.current = refresh
    void refetchToday(); void refetchWallets(); void refetchParticipations()
    if (day !== undefined) void refetchDaily()
  }, [refresh, day, refetchToday, refetchWallets, refetchParticipations, refetchDaily])
  return <div className="my-5">
    <dl className="grid grid-cols-3 divide-x divide-border">
      {([
        ['Wallets today', daily.data?.[0]],
        ['Total wallets', wallets.data],
        ['Total participations', participations.data],
      ] as const).map(([label, value]) => <div key={label} className="px-2 first:pl-0 last:pr-0">
        <dt className="text-[10px] leading-relaxed text-muted-foreground sm:text-xs">{label}</dt>
        <dd className="mt-1 font-mono text-lg text-foreground tabular-nums sm:text-xl">{number(value)}</dd>
      </div>)}
    </dl>
    {unavailable && <div className="mt-2"><RetryLine label="Community stats unavailable. Retry" onRetry={() => { void today.refetch(); void wallets.refetch(); void participations.refetch(); if (day !== undefined) void daily.refetch() }} /></div>}
  </div>
}

function ConnectCommunityWallet() {
  const { connectors, connectAsync } = useConnect()
  const wallet = useWalletWait()
  const [choosing, setChoosing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const lock = useRef(false)
  const detected = connectors.filter((c) => !(c.type === 'injected' && c.id === 'injected'))
  const choices = detected.length ? detected : connectors
  async function connect(connector: Connector) {
    if (lock.current) return
    lock.current = true
    setBusy(true)
    setError('')
    try {
      await requestWallet(wallet.wait, () => connectAsync({ connector }))
      track('wallet_connect')
    } catch (error) {
      setError(error instanceof WalletLaneBusyError
        ? 'A wallet request is already open elsewhere on this page. Finish or cancel it, then try again.'
        : 'Connection was not completed. Check your wallet, then try again.')
    } finally { lock.current = false; setBusy(false) }
  }
  return <div className="flex flex-col gap-2">
    <Button variant="outline" className="w-full" onClick={() => setChoosing((v) => !v)} disabled={busy} aria-expanded={choosing}>
      {busy ? 'Connecting wallet…' : 'Count me in today'}
    </Button>
    {choosing && <div className="flex flex-col gap-2 rounded-md border border-border p-3">
      <p className="text-xs text-muted-foreground">Connect a wallet to participate. No account registration or login signature.</p>
      {choices.map((c) => <Button key={c.uid} variant="ghost" size="sm" disabled={busy} onClick={() => void connect(c)}>{c.type === 'walletConnect' ? 'WalletConnect' : c.name}</Button>)}
      {choices.length === 0 && <p className="text-xs text-muted-foreground">Wallet options are loading. If none appear, open this page in your wallet browser.</p>}
    </div>}
    {error && <p role="status" className="text-xs text-destructive">{error}</p>}
  </div>
}

function ConnectedCheckin({ address, allowDisconnect, onConfirmed, onBusyChange }: { address: Address; allowDisconnect: boolean; onConfirmed: () => void; onBusyChange?: (busy: boolean) => void }) {
  const { chainId } = useAccount()
  const { disconnect } = useDisconnect()
  const client = usePublicClient({ chainId: OPBNB_CHAIN.id })
  const { sendTransactionAsync } = useSendTransaction()
  const { switchChainAsync } = useSwitchChain()
  const wallet = useWalletWait()
  const lock = useRef(false)
  const [busy, setBusy] = useState(false)
  const [hash, setHash] = useState<Hash>()
  const [pending, setPending] = useState(false)
  useEffect(() => { onBusyChange?.(busy || pending) }, [busy, pending, onBusyChange])
  useEffect(() => () => onBusyChange?.(false), [onBusyChange])
  const [message, setMessage] = useState('')
  const [failed, setFailed] = useState(false)
  const eligibility = useReadContract({
    ...contract, functionName: 'canCheckIn', args: [address],
    query: { refetchInterval: 30_000 },
  })
  const personal = useReadContract({ ...contract, functionName: 'users', args: [address], query: { refetchInterval: 30_000 } })
  const paused = useReadContract({ ...contract, functionName: 'paused', query: { refetchInterval: 30_000 } })
  const day = useReadContract({ ...contract, functionName: 'currentDay', query: { refetchInterval: 30_000 } })
  const streak = personal.data && day.data !== undefined
    ? (personal.data[0] + 1n < day.data ? 0n : personal.data[1]) : undefined
  const statusUnavailable = eligibility.isError || paused.isError
  const checking = !statusUnavailable && (eligibility.data === undefined || paused.data === undefined)

  function handleClick() {
    if (!pending && statusUnavailable) {
      void eligibility.refetch()
      void paused.refetch()
      return
    }
    void checkIn()
  }

  async function checkIn() {
    if (lock.current || !client) return
    lock.current = true
    setBusy(true)
    setFailed(false)
    let submitted = pending ? hash : undefined
    try {
      if (!submitted) {
        const [current, pauseState] = await Promise.all([eligibility.refetch(), paused.refetch()])
        if (current.error) throw current.error
        if (pauseState.error) throw pauseState.error
        if (pauseState.data !== false) { setMessage('Community participation is temporarily paused. Please try again later.'); return }
        if (!current.data) { setMessage('Already checked in today. Come back after 00:00 UTC.'); return }
        if (chainId !== OPBNB_CHAIN.id) {
          setMessage('Switch to opBNB in your wallet.')
          const switched = await requestWallet(wallet.wait, () => switchChainAsync({ chainId: OPBNB_CHAIN.id }))
          if (switched.id !== OPBNB_CHAIN.id) { setFailed(true); setMessage('Switch your wallet to opBNB before participating.'); return }
        }
        const gas = await client.estimateGas({ account: address, to: contract.address, data: checkInData, value: 0n })
        setMessage('Approve the check-in and network fee in your wallet.')
        submitted = await requestWallet(wallet.wait, () => sendTransactionAsync({
          account: address, chainId: OPBNB_CHAIN.id, to: contract.address, data: checkInData, value: 0n,
          gas: gas * 120n / 100n,
        }))
        track('checkin_submit')
        setHash(submitted)
        setPending(true)
      }
      setMessage('Transaction submitted. Waiting for confirmation…')
      const receipt = await client.waitForTransactionReceipt({ hash: submitted, timeout: 60_000 })
      setPending(false)
      if (receipt.status === 'reverted') {
        setFailed(true)
        setMessage('Check-in reverted. The network fee may still have been charged. Check the transaction before retrying.')
      } else {
        track('checkin_confirm')
        setMessage('Your participation is recorded. Thank you for showing up.')
        onConfirmed()
      }
      await eligibility.refetch()
      await personal.refetch()
    } catch (error) {
      if (submitted) {
        setMessage('Confirmation is still unknown. Check the transaction or check its status again.')
      } else {
        setFailed(true)
        setMessage(error instanceof WalletLaneBusyError
          ? 'A wallet request is still open. Complete or reject it in your wallet before trying again.'
          : error instanceof BaseError ? error.shortMessage : 'Unable to check in. Check your connection and opBNB BNB balance, then try again.')
      }
    } finally {
      lock.current = false
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <div className="flex w-full flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span className="flex items-center gap-2">
          <span className="font-mono">{address.slice(0, 6)}…{address.slice(-4)}</span>
          {allowDisconnect && <button type="button" onClick={() => disconnect()} disabled={busy || pending}
            className="cursor-pointer underline decoration-border-strong underline-offset-2 disabled:cursor-not-allowed disabled:opacity-50">Disconnect wallet</button>}
        </span>
        <span>My record: <strong className="font-mono font-medium text-foreground">{number(personal.data?.[3])}</strong> days · <strong className="font-mono font-medium text-foreground">{number(streak)}</strong> day streak</span>
      </div>
      {(personal.isError || day.isError) && <RetryLine label="Your record is unavailable. Retry" onRetry={() => { void personal.refetch(); void day.refetch() }} />}
      <Button variant="outline" className="w-full" onClick={handleClick}
        aria-busy={busy || (!pending && checking)}
        disabled={busy || !client || (!pending && (checking || (statusUnavailable && (eligibility.isFetching || paused.isFetching)) || (!statusUnavailable && (paused.data || eligibility.data === false))))}>
        {!busy && !pending && checking ? <>
          <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4 motion-safe:animate-spin" fill="none">
            <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" opacity="0.25" />
            <path d="M12 3a9 9 0 0 1 9 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          Checking…
        </> : busy ? 'Recording participation…' : pending ? 'Check transaction status' : statusUnavailable ? 'Retry status check' : paused.data ? 'Participation paused' : eligibility.data === false ? 'You’re counted today' : 'Count me in today'}
      </Button>
      {!pending && statusUnavailable && <p role="status" className="text-xs text-destructive">Could not load your check-in status. Please retry.</p>}
      {!pending && paused.data && <p role="status" className="text-xs text-muted-foreground">Community participation is temporarily paused. Please try again later.</p>}
      {message && <p role="status" className={`text-xs ${failed ? 'text-destructive' : 'text-muted-foreground'}`}>{message}</p>}
      {hash && <a className="text-xs text-copper underline" href={`https://opbnbscan.com/tx/${hash}`} target="_blank" rel="noopener noreferrer">View transaction</a>}
    </div>
  )
}
