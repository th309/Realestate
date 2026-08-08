import { describe, it, expect } from "vitest";
import { isOpaqueMapImageryUrl } from "./map-imagery-hosts";

/**
 * Regression guard for the `cross-origin-copy-response` 503.
 *
 * Street View images load cross-origin via <img>, so the browser hands the
 * service worker an OPAQUE response. Serwist's defaultCache cross-origin route
 * calls copyResponse on it, which throws on an opaque body, and the handler
 * then synthesizes a 503 — the image fails in the browser while a direct curl
 * of the same URL returns 200. Observed in production 2026-08-08; the same bug
 * was previously fixed for Supabase Storage (see app/sw.ts).
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
