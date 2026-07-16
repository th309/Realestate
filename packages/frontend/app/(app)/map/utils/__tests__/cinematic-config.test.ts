import { describe, it, expect, afterEach } from "vitest";
import {
  isCinematicZoomEnabled,
  getCinematicConfig,
} from "../cinematic-config";

afterEach(() => {
  delete process.env.NEXT_PUBLIC_CINEMATIC_ZOOM;
});

describe("isCinematicZoomEnabled", () => {
  it("is off when the env var is unset", () => {
    expect(isCinematicZoomEnabled()).toBe(false);
  });
  it("is on only for the exact string 'true'", () => {
    process.env.NEXT_PUBLIC_CINEMATIC_ZOOM = "true";
    expect(isCinematicZoomEnabled()).toBe(true);
    process.env.NEXT_PUBLIC_CINEMATIC_ZOOM = "1";
    expect(isCinematicZoomEnabled()).toBe(false);
  });
});

describe("getCinematicConfig", () => {
  it("enables real 3D and full tilt for zip", () => {
    const c = getCinematicConfig("zip");
    expect(c.enable3D).toBe(true);
    // Tilt was intentionally halved (55 -> 28) in efa76be9 to fix off-center
    // framing at high pitch; assert "clearly steeper than city" rather than
    // the old exact value so this doesn't re-drift on the next tuning pass.
    expect(c.pitch).toBeGreaterThanOrEqual(25);
  });
  it("keeps metro flat with no 3D", () => {
    const c = getCinematicConfig("metro");
    expect(c.enable3D).toBe(false);
    expect(c.pitch).toBeLessThanOrEqual(5);
  });
  it("keeps county near-flat with no 3D", () => {
    const c = getCinematicConfig("county");
    expect(c.enable3D).toBe(false);
    expect(c.pitch).toBeLessThanOrEqual(15);
  });
});
