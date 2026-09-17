'use client'
import { useState, type ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createConfig, http, WagmiProvider } from 'wagmi'
import { injected, walletConnect } from 'wagmi/connectors'
import { opBNB } from 'viem/chains'
import { WalletWaitProvider } from './WalletWait'
import { SITE_URL } from '@/lib/deployment'

function config() {
  const projectId = process.env.NEXT_PUBLIC_REOWN_PROJECT_ID
  return createConfig({
    chains: [opBNB], ssr: true,
    // Avoid Multicall3: every contract read targets the published check-in address.
    batch: { multicall: false },
    transports: { [opBNB.id]: http('https://opbnb-mainnet-rpc.bnbchain.org') },
    connectors: [injected(), ...(projectId ? [walletConnect({ projectId, metadata: {
      name: 'MPC Pre CheckIn', description: 'Daily MPC community participation on opBNB.',
      url: typeof window === 'undefined' ? SITE_URL : window.location.origin,
      icons: [SITE_URL + '/icon.svg'],
    } })] : [])],
  })
}
export function Providers({ children }: { children: ReactNode }) {
  const [wagmi] = useState(config)
  const [query] = useState(() => new QueryClient())
  return <WagmiProvider config={wagmi}><QueryClientProvider client={query}>
    <WalletWaitProvider>{children}</WalletWaitProvider>
  </QueryClientProvider></WagmiProvider>
}
