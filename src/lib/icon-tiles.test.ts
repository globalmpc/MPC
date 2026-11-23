import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(__dirname, "..", "..");
const read = (...path: string[]) => readFileSync(join(ROOT, ...path), "utf8");

describe("icon tiles (design system content/logo.json, Clearspace - icon tiles)", () => {
  const tileScale = read("scripts", "icons", "tile-scale.mjs");
  const constant = (name: string) =>
    Number(new RegExp(`export const ${name} = ([\\d.]+);`).exec(tileScale)?.[1]);
  const markUnits = constant("MARK_UNITS");
  const viewbox = constant("VIEWBOX");
  const small = constant("SMALL_TILE_SCALE");
  const large = constant("LARGE_TILE_SCALE");
  const tiny = constant("TINY_TILE_SCALE");
  const tinyBelow = constant("TINY_TILE_BELOW");
  const largeFrom = constant("LARGE_TILE_FROM");
  const icon = read("public", "icon.svg");

  it("is authored at the small-tile scale", () => {
    expect(icon).toContain(`scale(${small})`);
  });

  it("keeps the mark at 24px or more in a 32px tile, with at least 0.15x clearspace", () => {
    const mark = markUnits * small;
    expect((mark / viewbox) * 32).toBeGreaterThanOrEqual(24);
    expect((viewbox - mark) / 2 / mark).toBeGreaterThanOrEqual(0.15);
  });

  /** The mark scale that icon.svg's `@media (<query>)` rule applies. */
  const ruleScale = (query: string) => {
    const escaped = query.replace(/[.()]/g, "\\$&");
    const rule = new RegExp(`@media \\(${escaped}\\) \\{\\s*#mark \\{[^}]*scale\\(([\\d.]+)\\)`);
    return Number(rule.exec(icon)?.[1]);
  };

  it("has exactly the two size rules", () => {
    expect(icon.match(/@media/g)).toHaveLength(2);
  });

  it("draws the mark at 24px in a 24px tile and switches to it below 32px", () => {
    expect((markUnits * tiny * 24) / viewbox).toBeGreaterThanOrEqual(23.995);
    // 31.98 rather than 31, so a fractional width such as 31.5px is still below 32px.
    expect(ruleScale(`max-width: ${tinyBelow - 0.02}px`)).toBe(tiny);
  });

  it("leaves 0.5x clearspace from a 48px tile up, with the mark at 24px, and switches to it", () => {
    const mark = markUnits * large;
    expect((viewbox - mark) / 2 / mark).toBeCloseTo(0.5, 3);
    expect((mark / viewbox) * 48).toBeGreaterThanOrEqual(23.995);
    expect(ruleScale(`min-width: ${largeFrom}px`)).toBe(large);
  });

  it("uses a radius on the 2/4/6/10px scale and no literal radius of 5", () => {
    expect(icon).not.toContain('rx="5"');
    expect(icon).toMatch(/rx="(2|4|6|10)"/);
  });
});

describe("page icons", () => {
  it("links no SVG or PNG tab icon, so tabs use the baked favicon.ico", () => {
    // Chrome draws an SVG favicon without its @media rules (a 12px mark in a 16px tab), so the
    // only icons in src/app are the per-size favicon.ico and the 180px apple-icon.png.
    const icons = readdirSync(join(ROOT, "src", "app")).filter((f) => /^(icon|favicon|apple-icon)/.test(f));
    expect(icons.sort()).toEqual(["apple-icon.png", "favicon.ico"]);
  });

  it("still serves /icon.svg for the wallet connection metadata", () => {
    expect(read("src", "components", "Providers.tsx")).toContain("'/icon.svg'");
    expect(existsSync(join(ROOT, "public", "icon.svg"))).toBe(true);
  });
});

describe("favicon.ico as baked", () => {
  const ico = readFileSync(join(ROOT, "src", "app", "favicon.ico"));
  // Each entry is a 32bpp DIB: a 40-byte header, BGRA pixels bottom-up, then the 1-bit AND mask.
  const entries = Array.from({ length: ico.readUInt16LE(4) }, (_, i) => {
    const at = 6 + i * 16;
    const size = ico[at] || 256;
    const pixels = ico.readUInt32LE(at + 12) + 40;
    const stride = Math.ceil(size / 32) * 4;
    const mask = pixels + size * size * 4;
    const alpha = (x: number, y: number) => ico[pixels + (y * size + x) * 4 + 3];
    const colour = (x: number, y: number) =>
      ico.subarray(pixels + (y * size + x) * 4, pixels + (y * size + x) * 4 + 3);
    const masked = (x: number, y: number) => (ico[mask + y * stride + (x >> 3)] >> (7 - (x & 7))) & 1;
    const isMark = (x: number, y: number) => {
      const p = pixels + (y * size + x) * 4;
      return ico[p + 2] > 120 && ico[p + 2] - ico[p] > 40 && ico[p + 3] > 100;
    };
    return { size, alpha, colour, masked, isMark };
  });

  it("holds the 16, 32 and 48px tiles", () => {
    expect(entries.map((e) => e.size)).toEqual([16, 32, 48]);
  });

  it.each([16, 32, 48])("draws the mark in the %ipx tile at the tile's scale", (size) => {
    const { isMark } = entries.find((e) => e.size === size)!;
    let rows = 0;
    for (let y = 0; y < size; y++) {
      if (Array.from({ length: size }, (_, x) => isMark(x, y)).some(Boolean)) rows++;
    }
    // Edge to edge below 32px, 24px at 32px (0.15x space) and at 48px (0.5x space).
    expect(Math.abs(rows - Math.min(size, 24))).toBeLessThanOrEqual(1);
  });

  it.each([16, 32, 48])("masks exactly the transparent pixels of the %ipx tile", (size) => {
    const { alpha, colour, masked } = entries.find((e) => e.size === size)!;
    let set = 0;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        expect(masked(x, y), `${x},${y}`).toBe(alpha(x, y) < 128 ? 1 : 0);
        // A reader that ignores alpha draws (screen AND mask) XOR colour: masked colour must be 0.
        if (masked(x, y)) expect([...colour(x, y)], `${x},${y}`).toEqual([0, 0, 0]);
        set += masked(x, y);
      }
    }
    expect(set).toBeGreaterThan(0);
  });
});
