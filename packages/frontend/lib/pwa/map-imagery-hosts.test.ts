import { describe, it, expect } from "vitest";
import { isOpaqueMapImageryUrl } from "./map-imagery-hosts";

/**
 * Guards the routing predicate for Street View imagery.
 *
 * Street View URLs are signature-bound to their exact query, so caching them is
 * waste — the same reasoning as `supabaseStorageNetworkOnly` in app/sw.ts.
 * This is NOT a fix for the 2026-08-08 production 503, which was proven
 * client-side (unregistering the service worker did not change it; the same
 * URL loaded in Firefox and from a different origin in the same Chrome).
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
