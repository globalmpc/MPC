'use client'
import { useEffect } from 'react'
import { measurementId } from '@/lib/analytics'
import { SITE_URL } from '@/lib/deployment'

export function Analytics() {
  useEffect(() => {
    const id = measurementId(process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID)
    // Keep local and preview activity out of the production property.
    if (!id || window.location.origin !== SITE_URL || navigator.globalPrivacyControl || window.gtag) return
    window.dataLayer = window.dataLayer || []
    // Google's gtag queue uses Arguments objects for commands.
    // eslint-disable-next-line prefer-rest-params
    window.gtag = function () { window.dataLayer!.push(arguments) }
    window.gtag('js', new Date())
    window.gtag('config', id, {
      page_location: SITE_URL + '/', page_referrer: document.referrer ? new URL(document.referrer).origin : '',
      allow_google_signals: false, allow_ad_personalization_signals: false,
      cookie_domain: 'pre-check-in.globalmpc.tech',
    })
    const script = document.createElement('script')
    script.async = true
    script.src = `https://www.googletagmanager.com/gtag/js?id=${id}`
    document.head.appendChild(script)
  }, [])
  return null
}
