import type { ButtonHTMLAttributes } from 'react'
export function Button({ variant = 'outline', size = 'md', className = '', type = 'button', ...props }:
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'outline' | 'ghost'; size?: 'md' | 'sm' }) {
  return <button type={type} {...props} className={`inline-flex items-center justify-center gap-2 rounded-md border font-medium cursor-pointer disabled:cursor-not-allowed disabled:opacity-45 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring transition-colors hover:bg-accent ${variant === 'ghost' ? 'border-transparent text-muted-foreground' : 'border-current text-copper'} ${size === 'sm' ? 'px-3 py-2 text-xs' : 'px-6 py-3 text-sm'} ${className}`} />
}
