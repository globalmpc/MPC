import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { Analytics } from './Analytics'
const gtagScripts = () => Array.from(document.querySelectorAll('script')).filter(s => s.src.includes('googletagmanager'))
beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_GA_MEASUREMENT_ID', 'G-PRECHECKIN')
  vi.stubGlobal('location', new URL('https://pre-check-in.globalmpc.tech/?wallet=secret#private'))
  delete window.gtag; delete window.dataLayer
})
afterEach(() => {
  cleanup(); gtagScripts().forEach(s => s.remove())
  delete window.gtag; delete window.dataLayer
  vi.unstubAllGlobals(); vi.unstubAllEnvs()
})
it('initializes the dedicated property once and strips URL query and fragment', () => {
  const view = render(<Analytics />)
  view.rerender(<Analytics />)
  const commands = window.dataLayer!.map(command => Array.from(command as ArrayLike<unknown>))
  expect(commands.filter(command => command[0] === 'config')).toEqual([
    ['config', 'G-PRECHECKIN', expect.objectContaining({ page_location: 'https://pre-check-in.globalmpc.tech/', allow_google_signals: false })],
  ])
  expect(gtagScripts()).toHaveLength(1)
})
it('does not load analytics without the build variable', () => {
  vi.stubEnv('NEXT_PUBLIC_GA_MEASUREMENT_ID', '')
  render(<Analytics />)
  expect(gtagScripts()).toHaveLength(0)
})
it('does not collect preview traffic', () => {
  vi.stubGlobal('location', new URL('https://preview.vercel.app'))
  render(<Analytics />)
  expect(gtagScripts()).toHaveLength(0)
})
