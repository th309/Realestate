import type { GeoLevel } from "@/lib/data";

/** Build-time kill switch. Default OFF — map behaves as today unless set to "true". */
export function isCinematicZoomEnabled(): boolean {
  return process.env.NEXT_PUBLIC_CINEMATIC_ZOOM === "true";
}

export interface CinematicConfig {
  pitch: number;
  padding: number;
  enable3D: boolean;
}

// Real 3D only at the granular end (zip/tract); flat elsewhere — no fake-3D.
const CONFIG_BY_LEVEL: Record<GeoLevel, CinematicConfig> = {
  national: { pitch: 0, padding: 80, enable3D: false },
  state: { pitch: 0, padding: 80, enable3D: false },
  metro: { pitch: 0, padding: 80, enable3D: false },
  county: { pitch: 10, padding: 80, enable3D: false },
  city: { pitch: 20, padding: 70, enable3D: false },
  zip: { pitch: 55, padding: 60, enable3D: true },
  tract: { pitch: 55, padding: 60, enable3D: true },
};

export function getCinematicConfig(geoLevel: GeoLevel): CinematicConfig {
  return CONFIG_BY_LEVEL[geoLevel] ?? CONFIG_BY_LEVEL.metro;
}
