import type { NextConfig } from 'next'
import { OPBNB_RPC_URL } from './src/lib/deployment'
import { measurementId } from './src/lib/analytics'

const config: NextConfig = {
  poweredByHeader: false,
  async headers() {
    const isDev = process.env.NODE_ENV === 'development'
    const analytics = measurementId(process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID)
    const walletConnect = Boolean(process.env.NEXT_PUBLIC_REOWN_PROJECT_ID)
    const tagManager = 'https://www.googletagmanager.com'
    // Next.js emits inline hydration scripts for this statically generated page.
    const scripts = ["'self'", "'unsafe-inline'"]
    const connections = ["'self'", OPBNB_RPC_URL]
    if (isDev) scripts.push("'unsafe-eval'")
    if (analytics) {
      scripts.push(tagManager)
      connections.push(tagManager, 'https://*.google-analytics.com', 'https://analytics.google.com', 'https://*.analytics.google.com')
    }
    if (process.env.VERCEL_ENV === 'preview') {
      scripts.push('https://vercel.live/_next-live/feedback/')
      connections.push('https://vercel.live', 'wss://ws-us3.pusher.com')
    }
    if (walletConnect) {
      connections.push(
        'https://api.web3modal.org', 'https://rpc.walletconnect.org',
        'https://pulse.walletconnect.org', 'https://verify.walletconnect.org',
        'https://verify.walletconnect.com', 'https://echo.walletconnect.com',
        'https://relay.walletconnect.org', 'https://relay.walletconnect.com',
        'wss://relay.walletconnect.org', 'wss://relay.walletconnect.com',
      )
    }

    const policy = [
      "frame-ancestors 'none'", "object-src 'none'", "base-uri 'none'",
      "form-action 'self'", "script-src-attr 'none'",
      `script-src ${scripts.join(' ')}`, `connect-src ${connections.join(' ')}`,
    ]

    return [{
      source: '/:path*',
      headers: [
        { key: 'Content-Security-Policy', value: policy.join('; ') },
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      ],
    }]
  },
}
export default config
