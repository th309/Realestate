import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { buildAerialUrl } from "../buildAerialUrl";

const ORIGINAL = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

describe("buildAerialUrl", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_MAPBOX_TOKEN = "pk.test-token";
  });
  afterEach(() => {
    process.env.NEXT_PUBLIC_MAPBOX_TOKEN = ORIGINAL;
  });

  it("builds a satellite static image centred on the property", () => {
    const url = buildAerialUrl(40.4574, -88.9931) as string;
    expect(url).toContain("/styles/v1/mapbox/satellite-streets-v12/static/");
    expect(url).toContain("-88.9931,40.4574,18");
    expect(url).toContain("640x400@2x");
    expect(url).toContain("access_token=pk.test-token");
  });

  it("places an indigo subject pin at the property", () => {
    const url = buildAerialUrl(40.4574, -88.9931) as string;
    expect(url).toContain("pin-s+3949AB(-88.9931,40.4574)");
  });

  it("keeps Mapbox attribution burned into the image", () => {
    const url = buildAerialUrl(40.4574, -88.9931) as string;
    expect(url).not.toContain("attribution=false");
    expect(url).not.toContain("logo=false");
  });

  it("returns null when the Mapbox token is absent", () => {
    delete process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    expect(buildAerialUrl(40.4574, -88.9931)).toBeNull();
  });
});
