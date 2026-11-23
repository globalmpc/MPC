# Icon tiles

`public/icon.svg` is the only drawing of the mark for icons. Do not edit `apple-icon.png` or
`favicon.ico` by hand; rebuild them:

```bash
pnpm build:icons
```

`scripts/icons/tile-scale.mjs` holds the scale per tile size, from the design system rule
"Clearspace - icon tiles":

| Tile | Mark scale | Result |
|---|---|---|
| below 32px | 1.2435 | mark is 24px (fills a 24px tile) |
| 32 to 47px | 0.94 | mark 24px or more, at least 0.15x clearspace |
| 48px and up | 0.6218 | mark 24px at 48px, 0.5x clearspace |

The tab icon is `src/app/favicon.ico`, baked at 16, 32 and 48px, each at its own scale. The SVG is not
linked as a page icon: Chrome draws an SVG favicon without applying its `@media` rules, which left a
12px mark in a 16px tab. `icon.svg` stays in `public/` because the wallet connection metadata
(`src/components/Providers.tsx`) points wallets at `/icon.svg`.

`icon.svg` carries the 32 to 47px scale and switches to the other two with `@media (max-width:
31.98px)` and `@media (min-width: 48px)` rules, which apply where it is drawn as an image, such as a
wallet's `<img>`.

The raster files are baked at the scale for their own size with those rules removed, so they do not
depend on them. The `.ico` carries an AND mask taken from the alpha channel, with the colour of each
masked pixel at 0, so readers that ignore alpha still draw the corners transparent.
`src/lib/icon-tiles.test.ts` holds the numbers and measures the baked `.ico`.
