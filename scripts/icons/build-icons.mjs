/**
 * Bakes the raster icons from `public/icon.svg`:
 *
 *   node scripts/icons/build-icons.mjs        (pnpm build:icons)
 *
 *   src/app/apple-icon.png   180px, square ground (iOS rounds it itself)
 *   src/app/favicon.ico      16, 32 and 48px, rounded ground as in the SVG
 *
 * The mark is not redrawn here: this only rasterises `icon.svg` at the scale for each size
 * (`tile-scale.mjs`), so the geometry has one source and cannot drift.
 *
 * The .ico payload is 32bpp BMP (DIB), not PNG, because the consumers that fetch `/favicon.ico`
 * without reading the page head are the old parsers that cannot read PNG entries.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { VIEWBOX, forTile } from "./tile-scale.mjs";

/** Repository paths, resolved from this file so the script works from any directory. */
const repo = (path) => fileURLToPath(new URL(`../../${path}`, import.meta.url));

const SOURCE = readFileSync(repo("public/icon.svg"), "utf8");
const SQUARE = SOURCE.replace(/ rx="[\d.]+"/, "");
if (SQUARE === SOURCE) throw new Error("icon.svg: expected a rounded ground (rx) to square off");

const SUPERSAMPLE = 4;
const ICO_SIZES = [16, 32, 48];

const raw = (svg, size) =>
  sharp(Buffer.from(forTile(svg, size)), { density: (72 * size * SUPERSAMPLE) / VIEWBOX })
    .resize(size, size, { kernel: "lanczos3" })
    .ensureAlpha();

await raw(SQUARE, 180).png().toFile(repo("src/app/apple-icon.png"));
console.log("src/app/apple-icon.png  (180x180)");

function dib(rgba, size) {
  const header = Buffer.alloc(40);
  header.writeUInt32LE(40, 0);
  header.writeInt32LE(size, 4);
  header.writeInt32LE(size * 2, 8);
  header.writeUInt16LE(1, 12);
  header.writeUInt16LE(32, 14);
  // Colour data (BGRA) and the AND mask, both bottom-up. The mask is for readers that ignore the
  // alpha channel: a set bit marks a pixel transparent, bits most significant first, each row
  // padded to 4 bytes. Such readers draw (screen AND mask) XOR colour, so a masked pixel keeps its
  // alpha but its colour is left at 0, or it would tint the screen behind it.
  const xor = Buffer.alloc(size * size * 4);
  const stride = Math.ceil(size / 32) * 4;
  const and = Buffer.alloc(size * stride);
  for (let y = 0; y < size; y++) {
    const source = (size - 1 - y) * size * 4;
    for (let x = 0; x < size; x++) {
      const from = source + x * 4;
      const to = (y * size + x) * 4;
      xor[to + 3] = rgba[from + 3];
      if (rgba[from + 3] < 128) {
        and[y * stride + (x >> 3)] |= 0x80 >> (x & 7);
        continue;
      }
      xor[to] = rgba[from + 2];
      xor[to + 1] = rgba[from + 1];
      xor[to + 2] = rgba[from];
    }
  }
  header.writeUInt32LE(xor.length + and.length, 20);
  return Buffer.concat([header, xor, and]);
}

const images = await Promise.all(
  ICO_SIZES.map(async (size) => {
    const { data } = await raw(SOURCE, size).raw().toBuffer({ resolveWithObject: true });
    return { size, dib: dib(data, size) };
  }),
);

const directory = Buffer.alloc(6 + images.length * 16);
directory.writeUInt16LE(1, 2);
directory.writeUInt16LE(images.length, 4);
let offset = directory.length;
images.forEach(({ size, dib: image }, i) => {
  const at = 6 + i * 16;
  directory[at] = size;
  directory[at + 1] = size;
  directory.writeUInt16LE(1, at + 4);
  directory.writeUInt16LE(32, at + 6);
  directory.writeUInt32LE(image.length, at + 8);
  directory.writeUInt32LE(offset, at + 12);
  offset += image.length;
});
writeFileSync(repo("src/app/favicon.ico"), Buffer.concat([directory, ...images.map((i) => i.dib)]));
console.log(`src/app/favicon.ico  (${ICO_SIZES.join(", ")} px, ${offset} bytes)`);
