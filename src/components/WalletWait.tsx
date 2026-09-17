'use client'
import { createContext, useContext, useRef, useState, type ReactNode } from 'react'
type Wait = <T>(start: () => Promise<T>) => Promise<T>
export class WalletLaneBusyError extends Error {}
const Context = createContext<{ wait: Wait } | null>(null)
export async function requestWallet<T>(wait: Wait, start: () => Promise<T>): Promise<T> { return wait(start) }
export function useWalletWait() {
  const value = useContext(Context)
  if (!value) throw new Error('WalletWaitProvider is required')
  return value
}
export function WalletWaitProvider({ children }: { children: ReactNode }) {
  const lock = useRef(false)
  const [overdue, setOverdue] = useState(false)
  const wait: Wait = async (start) => {
    if (lock.current) throw new WalletLaneBusyError()
    lock.current = true
    const timer = setTimeout(() => setOverdue(true), 20_000)
    try { return await start() }
    finally { clearTimeout(timer); lock.current = false; setOverdue(false) }
  }
  return <Context.Provider value={{ wait }}>{children}{overdue &&
    <div role="status" className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-lg rounded-lg border border-copper bg-surface p-4 text-sm">
      A request is still open in your wallet. Open your wallet to approve or reject it.
    </div>}</Context.Provider>
}
