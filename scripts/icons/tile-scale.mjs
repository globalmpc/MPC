/**
 * The mark's scale inside an icon tile, per the design system's icon tile rule
 * (`mustcompany/globalmpc-designsystem` content/logo.json, "Clearspace — icon tiles"):
 *
 *   - from a 48px tile up, 0.5x the mark's height of clearspace;
 *   - from 32px to 47px, at least 0.15x, with the mark at 24px or more;
 *   - below 32px the 24px minimum wins and the mark takes whatever space is left.
 *
 * With its stroke the drawn mark is 19.3 of the 24-unit box at scale 1.
 *
 *   TINY  1.2435 -> 24.0 units: the mark is 24px in a 24px tile and fills the tile's height.
 *   SMALL 0.94   -> 18.1 units: 24.2px in a 32px tile, 2.9 units (0.16x) each side.
 *   LARGE 0.6218 -> 12.0 units: the mark is 24px in a 48px tile, 6.0 units each side, 0.5x its height.
 *
 * `public/icon.svg` is authored at SMALL. Rules inside the file switch it to TINY when it is drawn as an
 * image narrower than 32px and to LARGE from 48px. Browser tabs do not use it: Chrome ignores those
 * rules in an SVG favicon, so the tab icon is the baked `src/app/favicon.ico`. The raster files are
 * baked here at the scale for their own size, with those rules removed, so they never depend on
 * whether the renderer evaluates `@media` (the bake renders at 4x, where a 16px tile would otherwise
 * match the 48px rule). The mark is never redrawn; only the scale changes.
 */
export const MARK_UNITS = 19.3;
export const VIEWBOX = 24;
export const SMALL_TILE_SCALE = 0.94;
export const LARGE_TILE_SCALE = 0.6218;
export const TINY_TILE_SCALE = 1.2435;
export const TINY_TILE_BELOW = 32;
export const LARGE_TILE_FROM = 48;

/** The icon source re-scaled for a tile of `size` pixels, without its size-dependent rules. */
export function forTile(svg, size) {
  const small = `scale(${SMALL_TILE_SCALE})`;
  if (!svg.includes(small)) throw new Error(`icon.svg: expected ${small} on the mark`);
  const fixed = svg.replace(/\s*<style>[\s\S]*?<\/style>/, "");
  if (size >= LARGE_TILE_FROM) return fixed.replace(small, `scale(${LARGE_TILE_SCALE})`);
  if (size < TINY_TILE_BELOW) return fixed.replace(small, `scale(${TINY_TILE_SCALE})`);
  return fixed;
}
