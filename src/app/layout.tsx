import type { Metadata } from 'next'
import { Providers } from '@/components/Providers'
import { Analytics } from '@/components/Analytics'
import { SITE_URL } from '@/lib/deployment'
import './globals.css'
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL), title: 'Pre CheckIn · MPC',
  description: 'Show up for MPC. Record your daily community participation on opBNB and explore MPC projects.',
  alternates: { canonical: '/' },
  openGraph: { title: 'MPC Pre CheckIn', description: 'Daily community participation on opBNB.', url: SITE_URL, type: 'website' },
}
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><Providers>{children}</Providers><Analytics /></body></html>
}
