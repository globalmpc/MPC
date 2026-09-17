import Image from 'next/image'
import Link from 'next/link'
import { DirectCheckinButton } from '@/components/Checkin'
import { Projects } from '@/components/Projects'
export default function Home() {
  const links = [
    ['Terms', 'https://www.globalmpc.tech/terms-of-use'],
    ['Privacy', 'https://www.globalmpc.tech/privacy-policy'],
    ['Cookies', 'https://www.globalmpc.tech/cookie-policy'],
  ]
  return <div className="relative isolate flex min-h-dvh flex-col overflow-x-clip">
    <div className="mpc-terrain pointer-events-none absolute inset-x-0 top-0 -z-10" aria-hidden="true" />
    <header className="flex items-center justify-between gap-4 px-5 py-5 sm:px-8">
      <Link href="/" aria-label="MPC Pre CheckIn home"><Image src="/brand/mpc-lockup.svg" alt="MPC" width={120} height={51} unoptimized /></Link>
      <span className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">opBNB · Community</span>
    </header>
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center gap-7 px-5 py-5 sm:px-8">
      <div className="text-center mpc-reveal">
        <h1 className="font-display text-4xl sm:text-5xl font-medium bg-linear-to-r from-copper via-copper-glow to-gold bg-clip-text text-transparent">Pre CheckIn</h1>
        <p className="mt-3 text-sm text-muted-foreground">Mining RWA, built together. One day at a time.</p>
      </div>
      <div className="grid items-start justify-items-center gap-5 md:grid-cols-2 mpc-reveal">
        <DirectCheckinButton />
        <Projects />
      </div>
    </main>
    <footer className="px-5 py-5 text-center text-[11px] text-muted-foreground">
      <nav aria-label="Footer" className="flex flex-wrap justify-center gap-x-4 gap-y-2">{links.map(([label, href]) =>
        <a key={label} href={href} target="_blank" rel="noopener noreferrer" className="hover:text-foreground underline-offset-4 hover:underline">{label}</a>)}</nav>
      <p className="mt-3">MPC · Currently in the design &amp; build stage.</p>
    </footer>
  </div>
}
