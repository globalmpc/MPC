export type AnalyticsEvent = 'wallet_connect' | 'checkin_submit' | 'checkin_confirm' | 'project_click'
declare global {
  interface Window { dataLayer?: unknown[]; gtag?: (...args: unknown[]) => void }
  interface Navigator { globalPrivacyControl?: boolean }
}
export function measurementId(value: string | undefined) {
  return value && /^G-[A-Z0-9]+$/.test(value) ? value : null
}
// Only an allowlisted event and project slug can leave the app. Never pass wallet data.
export function track(event: AnalyticsEvent, projectId?: string) {
  if (typeof window === 'undefined' || navigator.globalPrivacyControl) return
  const params = event === 'project_click' && projectId && /^[a-z0-9-]{1,64}$/.test(projectId)
    ? { project_id: projectId } : {}
  try { window.gtag?.('event', event, params) } catch { /* Analytics must never interrupt a wallet action. */ }
}
