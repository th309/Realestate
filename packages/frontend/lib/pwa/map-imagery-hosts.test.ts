import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { isOpaqueMapImageryUrl } from "./map-imagery-hosts";

/**
 * Guards the routing predicate for Street View imagery.
 *
 * Street View URLs are signature-bound to their exact query, so caching them is
 * waste — the same reasoning as `supabaseStorageNetworkOnly` in app/sw.ts.
 */
describe("isOpaqueMapImageryUrl", () => {
  it("matches the Street View Static image endpoint", () => {
    expect(
      isOpaqueMapImageryUrl(
        new URL(
          "https://maps.googleapis.com/maps/api/streetview?size=640x400&pano=abc&key=k&signature=s",
        ),
      ),
    ).toBe(true);
  });

  it("matches the Street View metadata endpoint", () => {
    expect(
      isOpaqueMapImageryUrl(
        new URL(
          "https://maps.googleapis.com/maps/api/streetview/metadata?location=1,2&key=k",
        ),
      ),
    ).toBe(true);
  });

  it("does not match unrelated Google hosts", () => {
    expect(
      isOpaqueMapImageryUrl(
        new URL("https://www.googletagmanager.com/gtag/js?id=G-1"),
      ),
    ).toBe(false);
    expect(
      isOpaqueMapImageryUrl(
        new URL("https://fonts.googleapis.com/css2?family=Roboto"),
      ),
    ).toBe(false);
  });

  it("does not match same-origin app URLs", () => {
    expect(
      isOpaqueMapImageryUrl(
        new URL("https://www.propertyiq.app/analyzer?address=123"),
      ),
    ).toBe(false);
  });

  it("does not hijack Mapbox, which already works through defaultCache", () => {
    expect(
      isOpaqueMapImageryUrl(
        new URL(
          "https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12/static/-77.4,39.4,18/640x400@2x?access_token=t",
        ),
      ),
    ).toBe(false);
  });
});

/**
 * Regression guard for the production failure of 2026-08-08.
 *
 * The service worker intercepts the <img> request and re-issues it with
 * fetch(). A fetch() from a service worker is governed by `connect-src`, NOT
 * `img-src` — so allowing the host in img-src alone left it blocked, workbox
 * reported `no-response`, and the tile rendered broken while a direct curl of
 * the identical URL returned 200. Mapbox was unaffected purely because
 * api.mapbox.com already appears in connect-src.
 *
 * Both directives must list the host. Dropping either breaks Street View only
 * in production, because Serwist is disabled in dev.
 */
describe("CSP allows Street View through the service worker", () => {
  const config = readFileSync(join(process.cwd(), "next.config.mjs"), "utf8");

  const directive = (name: string): string => {
    const match = config.match(new RegExp(name + " [^;`]*"));
    if (!match) throw new Error(name + " directive not found in next.config.mjs");
    return match[0];
  };

  it("lists maps.googleapis.com in img-src so the <img> tag is allowed", () => {
    expect(directive("img-src")).toContain("https://maps.googleapis.com");
  });

  it("lists maps.googleapis.com in connect-src so the SW fetch() is allowed", () => {
    expect(directive("connect-src")).toContain("https://maps.googleapis.com");
  });
});
