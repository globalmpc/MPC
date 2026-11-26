// @vitest-environment node
import { afterEach, expect, it, vi } from 'vitest'
import config from '../../next.config'
import { OPBNB_RPC_URL } from './deployment'

afterEach(() => vi.unstubAllEnvs())

async function productionHeaders({ qr = false, ga = false, preview = false } = {}) {
  vi.stubEnv('NODE_ENV', 'production')
  vi.stubEnv('NEXT_PUBLIC_REOWN_PROJECT_ID', qr ? 'test-project' : '')
  vi.stubEnv('NEXT_PUBLIC_GA_MEASUREMENT_ID', ga ? 'G-TEST' : '')
  vi.stubEnv('VERCEL_ENV', preview ? 'preview' : 'production')
  const [rule] = await config.headers!()
  expect(rule.source).toBe('/:path*')
  return new Headers(rule.headers.map(({ key, value }) => [key, value]))
}

it('protects every route and restricts connections to the site and its RPC by default', async () => {
  const headers = await productionHeaders()
  const directives = headers.get('Content-Security-Policy')!.split('; ')
  expect(directives).toContain("frame-ancestors 'none'")
  expect(directives).toContain("script-src-attr 'none'")
  expect(directives).toContain("script-src 'self' 'unsafe-inline'")
  expect(directives).toContain(`connect-src 'self' ${OPBNB_RPC_URL}`)
  expect(headers.get('X-Frame-Options')).toBe('DENY')
  expect(headers.get('X-Content-Type-Options')).toBe('nosniff')
  expect(headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin')
})

it('permits the Vercel feedback toolbar only on preview builds', async () => {
  const preview = (await productionHeaders({ preview: true })).get('Content-Security-Policy')
  expect(preview).toContain('https://vercel.live/_next-live/feedback/')
  expect(preview).toContain('wss://ws-us3.pusher.com')
  const production = (await productionHeaders()).get('Content-Security-Policy')
  expect(production).not.toMatch(/vercel\.live|pusher\.com/)
})

it('adds each integration only when configured', async () => {
  const qr = (await productionHeaders({ qr: true })).get('Content-Security-Policy')
  expect(qr).toContain('wss://relay.walletconnect.org')
  expect(qr).not.toContain('google')
  const ga = (await productionHeaders({ ga: true })).get('Content-Security-Policy')
  expect(ga).toContain('https://www.googletagmanager.com')
  expect(ga).toContain('https://*.google-analytics.com')
  expect(ga).not.toContain('walletconnect')
})
