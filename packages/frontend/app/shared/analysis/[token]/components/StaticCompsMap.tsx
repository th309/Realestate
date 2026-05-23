interface Props {
  subjectLat: number | null;
  subjectLon: number | null;
  /** Optional comp pin coordinates for context. */
  compPins?: Array<{ lat?: number | null; lon?: number | null }>;
  /** Mapbox public token; component renders nothing if missing. */
  mapboxToken?: string;
  /** Brand accent for the subject pin (defaults to PIQ indigo). */
  accentHex?: string;
}

/**
 * Mapbox Static API raster for print/PDF use. Replaces the interactive
 * Mapbox GL map in CompsSection when we're rendering the share page —
 * vector tiles + JS hydration don't render reliably in Puppeteer.
 *
 * Uses Mapbox's stateless image endpoint:
 *   https://docs.mapbox.com/api/maps/static-images/
 *
 * Subject pin in accent color; up to 5 small-grey comp pins. Sized for
 * a half-row at PDF width (~3.5in × 2.5in).
 */
export function StaticCompsMap({
  subjectLat,
  subjectLon,
  compPins = [],
  mapboxToken,
  accentHex = "3949AB",
}: Props) {
  if (!mapboxToken || subjectLat == null || subjectLon == null) return null;

  const cleanHex = accentHex.replace(/^#/, "");
  // Subject pin (large)
  const subject = `pin-l+${cleanHex}(${subjectLon},${subjectLat})`;
  // Comp pins (small, neutral gray) — limit to 5 to keep URL under 8KB
  const comps = compPins
    .filter((p) => p.lat != null && p.lon != null)
    .slice(0, 5)
    .map((p) => `pin-s+94a3b8(${p.lon},${p.lat})`)
    .join(",");

  const overlay = [subject, comps].filter(Boolean).join(",");
  const w = 640;
  const h = 360;
  const zoom = 14;
  const url =
    `https://api.mapbox.com/styles/v1/mapbox/light-v11/static/` +
    `${overlay}/${subjectLon},${subjectLat},${zoom}/${w}x${h}@2x` +
    `?access_token=${encodeURIComponent(mapboxToken)}&logo=false&attribution=false`;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt="Property location" className="pdf-map" />
  );
}
