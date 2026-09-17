'use client'
import { projects } from '@/lib/projects'
import { track } from '@/lib/analytics'
export function Projects() {
  return <section aria-labelledby="projects-heading" className="w-full max-w-lg rounded-lg border border-border bg-surface/80 p-5 sm:p-6">
    <p className="font-mono text-[10px] tracking-widest text-copper uppercase">Explore the ecosystem</p>
    <h2 id="projects-heading" className="mt-3 font-display text-xl font-medium">Explore MPC</h2>
    <p className="mt-2 text-sm text-muted-foreground">Discover what’s happening across MPC.</p>
    <ul className="mt-5 divide-y divide-border">
      {projects.map(project => <li key={project.id}>
        <a href={project.url} target="_blank" rel="noopener noreferrer" onClick={() => track('project_click', project.id)}
          className="group flex min-h-16 items-center justify-between gap-4 py-3 focus-visible:outline-2 focus-visible:outline-ring">
          <span><span className="flex items-center gap-2 text-sm font-medium group-hover:text-copper">{project.name}</span>
            <span className="mt-1 block text-xs text-muted-foreground">{project.description}</span></span>
          <span aria-hidden="true" className="text-copper">↗</span>
          <span className="sr-only"> (opens in a new tab)</span>
        </a>
      </li>)}
    </ul>
  </section>
}
