'use client'
import { useState, type ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createConfig, http, WagmiProvider, type CreateConnectorFn } from 'wagmi'
import { injected, walletConnect } from 'wagmi/connectors'
import { opBNB } from 'viem/chains'
import { WalletWaitProvider } from './WalletWait'
import { OPBNB_RPC_URL, SITE_URL } from '@/lib/deployment'

function config() {
  const connectors: CreateConnectorFn[] = [injected()]
  const projectId = process.env.NEXT_PUBLIC_REOWN_PROJECT_ID
  if (projectId && typeof window !== 'undefined') {
    connectors.push(walletConnect({
      projectId,
      metadata: {
        name: 'MPC Pre CheckIn',
        description: 'Daily MPC community participation on opBNB.',
        url: window.location.origin,
        icons: [SITE_URL + '/icon.svg'],
      },
    }))
  }
  return createConfig({
    chains: [opBNB], ssr: true,
    // Avoid Multicall3: every contract read targets the published check-in address.
    batch: { multicall: false },
    transports: { [opBNB.id]: http(OPBNB_RPC_URL) },
    connectors,
  })
}
export function Providers({ children }: { children: ReactNode }) {
  const [wagmi] = useState(config)
  const [query] = useState(() => new QueryClient())
  return <WagmiProvider config={wagmi}><QueryClientProvider client={query}>
    <WalletWaitProvider>{children}</WalletWaitProvider>
  </QueryClientProvider></WagmiProvider>
}
