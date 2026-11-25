/**
 * Lion QA anchors for Pre-Check-In (FRONT-17, FRONT-47, FRONT-48).
 *
 * FRONT-17: one shared max-w-7xl shell; no nested max-w-5xl; main uses section rhythm.
 * FRONT-47: failure copy uses --destructive-text, not the fill colour.
 * FRONT-48: the radius values live only in the design-system copy (styles/tokens.css), as
 *           published; the Tailwind theme maps its keys to them with var() in an
 *           `@theme inline reference` block and writes no value of its own. Tokens stay layered
 *           so font stacks cannot shadow Inter Variable + Pretendard.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = join(__dirname, '..', '..')
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8')

/** The published radius scale (mustcompany/globalmpc-designsystem v0.3.0, dist/tokens.css). */
const RADIUS = {
  'radius-sm': '2px',
  'radius-md': '4px',
  'radius-lg': '6px',
  'radius-xl': '10px',
  radius: '4px',
} as const

describe('Pre-Check-In page shell (FRONT-17)', () => {
  const page = read('src/app/page.tsx')

  it('keeps one shared max-w-7xl shell with no nested max-w-5xl', () => {
    expect(page.match(/max-w-7xl/g)?.length).toBeGreaterThanOrEqual(3)
    expect(page).not.toMatch(/max-w-5xl/)
  })

  it('gives main the published section rhythm instead of py-5', () => {
    expect(page).toMatch(/<main\b[^>]*\bpy-24\b/)
    expect(page).toMatch(/<main\b[^>]*\blg:py-32\b/)
    expect(page).not.toMatch(/<main\b[^>]*\bpy-5\b/)
  })
})

describe('destructive text token (FRONT-47)', () => {
  it('declares --destructive-text and wires the Tailwind colour', () => {
    expect(read('styles/tokens.css')).toMatch(/--destructive-text:\s*oklch\(0\.64 0\.15 25\)/)
    expect(read('styles/theme.css')).toMatch(
      /--color-destructive-text:\s*var\(--destructive-text\)/,
    )
  })

  it('styles check-in failure copy with text-destructive-text, not the fill token', () => {
    const checkin = read('src/components/Checkin.tsx')
    expect(checkin).not.toMatch(/text-destructive(?![-\w])/)
    expect(checkin.match(/text-destructive-text/g)?.length).toBeGreaterThanOrEqual(3)
  })
})

describe('theme radii and font cascade (FRONT-48 / review of #9)', () => {
  const theme = read('styles/theme.css')
  const tokens = read('styles/tokens.css')
  /** CSS without comments, so a comment naming a token cannot satisfy or break a check. */
  const code = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, '')

  it('keeps tokens.css layered so its static font stacks cannot beat the theme', () => {
    expect(theme).toMatch(/@import\s+'\.\/tokens\.css'\s+layer\(mpc-design\)/)
  })

  it('loads Inter Variable + Pretendard from the theme, not the static Inter stack', () => {
    expect(theme).toMatch(/--font-sans:\s*'Inter Variable',\s*'Pretendard Variable'/)
    expect(theme).toMatch(
      /--font-display:\s*'Space Grotesk Variable',\s*'Pretendard Variable'/,
    )
    expect(theme).toMatch(
      /--font-mono:\s*'JetBrains Mono Variable',\s*'Pretendard Variable'/,
    )
  })

  it('keeps every published radius token in the design-system copy, with its published value', () => {
    for (const [name, value] of Object.entries(RADIUS)) {
      expect(code(tokens)).toMatch(new RegExp(`--${name}:\\s*${value};`))
    }
  })

  it('maps the Tailwind radius keys to the tokens with var(), in a block Tailwind does not emit', () => {
    // A plain @theme entry would be emitted as `--radius-sm: var(--radius-sm)`, a self reference;
    // `reference` keeps it to the utilities, which then read the token copy's value.
    const block = /@theme\s+inline\s+reference\s*\{([^}]*)\}/.exec(code(theme))?.[1] ?? ''
    for (const name of ['radius-sm', 'radius-md', 'radius-lg', 'radius-xl']) {
      expect(block).toMatch(new RegExp(`--${name}:\\s*var\\(--${name}\\);`))
    }
  })

  it('writes no radius value anywhere but the token copy', () => {
    // A second written copy of the scale is what FRONT-48 reported. --radius-full is not a step.
    const sheets = ['styles/theme.css', 'styles/pretendard.css', 'src/app/globals.css']
    for (const sheet of sheets) {
      expect(code(read(sheet)), sheet).not.toMatch(/--radius(-(sm|md|lg|xl))?\s*:\s*[\d.]/)
    }
    expect(existsSync(join(ROOT, 'styles', 'radius-scale.css'))).toBe(false)
    const checked = ['theme.css', 'tokens.css', 'pretendard.css']
    const unlisted = readdirSync(join(ROOT, 'styles')).filter((f) => f.endsWith('.css') && !checked.includes(f))
    expect(unlisted, 'a new stylesheet must be added to the check above').toEqual([])
  })
})
