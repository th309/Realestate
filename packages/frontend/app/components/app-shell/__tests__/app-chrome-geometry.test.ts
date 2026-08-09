import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * `--app-bar-h` and `--breadcrumbs-h` in globals.css are hand-measured from the
 * Tailwind classes on AppBar and GlobalBreadcrumbs. CSS cannot read a utility
 * class's height, so nothing in the build couples the two — change `h-14` to
 * `h-16` and the constant keeps claiming 57px, silently reopening the seam it
 * was added to close (page content scrolling through the gap between the two
 * bars) or hiding the top of every sticky element below them.
 *
 * These tests are that coupling. They fail loudly on the class change rather
 * than leaving a 7px artifact for someone to rediscover in the browser.
 */

// __tests__ -> app-shell -> components -> app -> packages/frontend
const frontend = join(__dirname, "..", "..", "..", "..");

/**
 * Comments are stripped before matching. These files explain the bug they fix
 * by naming the old class, so a raw read would find `top-16` in prose and fail
 * the very assertion that proves it is gone from the markup.
 */
const read = (rel: string) =>
  readFileSync(join(frontend, rel), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

const GLOBALS = read("app/globals.css");
const APP_BAR = read("app/components/app-shell/AppBar.tsx");
const SITE_HEADER = read("src/components/layout/Header.tsx");
const BREADCRUMBS = read("components/navigation/GlobalBreadcrumbs.tsx");

/** Pull a custom property's declared value out of globals.css. */
const cssVar = (name: string) =>
  GLOBALS.match(new RegExp(`${name}:\\s*([^;]+);`))?.[1]?.trim();

describe("--app-bar-h matches what AppBar actually measures", () => {
  it("is 57px: h-14 (56px) plus a 1px bottom border", () => {
    expect(APP_BAR).toContain("h-14");
    expect(APP_BAR).toContain("border-b");
    expect(cssVar("--app-bar-h")).toBe("57px");
  });

  it("grows by the safe-area inset when the installed PWA runs standalone", () => {
    // AppBar pads itself for the notch in standalone, so everything pinned
    // below it has to move down by the same amount.
    expect(APP_BAR).toContain("pt-safe-standalone");
    expect(GLOBALS).toMatch(
      /@media \(display-mode: standalone\)\s*\{\s*:root\s*\{\s*--app-bar-h:\s*calc\(57px \+ env\(safe-area-inset-top\)\)/,
    );
  });
});

describe("--site-bar-h matches what the marketing Header actually measures", () => {
  it("is 65px: h-16 (64px) plus a 1px bottom border", () => {
    // AppChrome renders this instead of AppBar on every non-APP_CHROME_ROUTE,
    // and it is 8px taller. One token cannot describe both bars.
    expect(SITE_HEADER).toContain("h-16");
    expect(SITE_HEADER).toContain("border-b");
    expect(cssVar("--site-bar-h")).toBe("65px");
  });

  it("also grows by the safe-area inset in standalone", () => {
    expect(SITE_HEADER).toContain("pt-safe-standalone");
    expect(GLOBALS).toMatch(
      /--site-bar-h:\s*calc\(65px \+ env\(safe-area-inset-top\)\)/,
    );
  });
});

describe("--breadcrumbs-h matches what GlobalBreadcrumbs actually measures", () => {
  it("is 37px: py-2 (16px) plus a text-sm line box (20px) plus a 1px border", () => {
    expect(BREADCRUMBS).toContain("py-2");
    expect(BREADCRUMBS).toContain("text-sm");
    expect(BREADCRUMBS).toContain("border-b");
    expect(cssVar("--breadcrumbs-h")).toBe("37px");
  });
});

describe("the sticky stack derives from the tokens, never from literals", () => {
  it("pins the breadcrumbs under whichever bar the route actually renders", () => {
    // A single offset is wrong for one regime or the other: `top-16` (64px)
    // left a 7px seam under the 57px AppBar and overlapped the 65px Header.
    expect(BREADCRUMBS).toContain("top-[var(--app-bar-h)]");
    expect(BREADCRUMBS).toContain("top-[var(--site-bar-h)]");
    expect(BREADCRUMBS).toContain("isAppChromeRoute");
    expect(BREADCRUMBS).not.toMatch(/\btop-16\b/);
  });

  it("composes both chrome sums so the standalone override reaches consumers", () => {
    // Declared as calcs over the bar tokens rather than literal 94px/102px:
    // custom properties substitute lazily, so redefining a bar height in the
    // standalone media query re-resolves these for free.
    expect(cssVar("--app-chrome-h")).toBe(
      "calc(var(--app-bar-h) + var(--breadcrumbs-h))",
    );
    expect(cssVar("--site-chrome-h")).toBe(
      "calc(var(--site-bar-h) + var(--breadcrumbs-h))",
    );
  });
});
