import { afterEach, expect, it, vi } from 'vitest'
import { measurementId, track } from './analytics'
afterEach(() => { delete window.gtag; Object.defineProperty(navigator, 'globalPrivacyControl', { value: false, configurable: true }) })
it('does not allow script content in a measurement ID', () => {
  expect(measurementId('G-ABC123')).toBe('G-ABC123')
  expect(measurementId('G-ABC<script>')).toBeNull()
  expect(measurementId(undefined)).toBeNull()
})
it('sends only a project slug, not arbitrary payloads', () => {
  window.gtag = vi.fn()
  track('project_click', 'mpc-app')
  track('project_click', 'https://example.com/?wallet=123')
  expect(window.gtag).toHaveBeenNthCalledWith(1, 'event', 'project_click', { project_id: 'mpc-app' })
  expect(window.gtag).toHaveBeenNthCalledWith(2, 'event', 'project_click', {})
})
it('respects Global Privacy Control', () => {
  window.gtag = vi.fn()
  Object.defineProperty(navigator, 'globalPrivacyControl', { value: true, configurable: true })
  track('checkin_confirm')
  expect(window.gtag).not.toHaveBeenCalled()
})
