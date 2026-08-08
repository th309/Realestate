import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const DIR = join(__dirname, "..");
const BEATS = readdirSync(DIR).filter(
  (f) => f.startsWith("Beat") && f.endsWith(".tsx") && f !== "BeatSection.tsx",
);

/**
 * Source with comments stripped. These guards describe what a beat RENDERS, so
 * a doc comment that names a banned token (explaining why it is banned) must
 * not trip them.
 */
const read = (file: string) =>
  readFileSync(join(DIR, file), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

describe("Beat sections defer to the layout contract", () => {
  it("finds the beat files to check", () => {
    expect(BEATS.length).toBeGreaterThan(5);
  });

  it.each(BEATS)("%s sets no container width of its own", (file) => {
    expect(read(file)).not.toMatch(/max-w-[2-7]xl/);
  });

  // Section-scale padding only. Small internal spacing such as py-2 on a chip
  // row is legitimate and must not fail this guard.
  it.each(BEATS)("%s sets no section-scale padding of its own", (file) => {
    expect(read(file)).not.toMatch(/\bpy-(1[0-9]|2[0-9]|3[0-9])\b/);
  });

  it.each(BEATS)("%s contains no arbitrary hex utility", (file) => {
    expect(read(file)).not.toMatch(/\[#[0-9A-Fa-f]{3,8}\]/);
  });
});

/**
 * Each beat now owns an opaque light surface band instead of sitting on a
 * page-wide indigo gradient. `text-primary-light` is a light-on-dark token, so
 * any surviving use is invisible body copy — the same class of desync the hex
 * purge exists to remove.
 */
describe("Beat sections are toned for light bands", () => {
  it.each(BEATS)("%s paints no light-on-dark body copy", (file) => {
    expect(read(file)).not.toMatch(/\btext-primary-light\b/);
    expect(read(file)).not.toMatch(/\btext-on-primary\b/);
  });
});

/**
 * Raw Tailwind palette colours (`bg-green-700`, `text-red-700`) sit outside the
 * M3 token system and do not flip in dark mode, exactly like a hex literal.
 */
describe("Beat sections use semantic tokens, not the raw palette", () => {
  it.each(BEATS)("%s uses no raw Tailwind palette colour", (file) => {
    expect(read(file)).not.toMatch(
      /\b(?:bg|text|border)-(?:red|green|blue|yellow|amber|indigo|slate|gray|grey|zinc|neutral|stone)-\d{2,3}\b/,
    );
  });
});
