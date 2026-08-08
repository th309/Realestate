"use client";

import { usePropertyImagery } from "@/lib/data";
import { buildAerialUrl } from "./buildAerialUrl";

interface PropertyImageryProps {
  lat: number | null;
  lon: number | null;
  /** Resolved address, used for image alt text. */
  address: string;
}

const TILE =
  "relative aspect-[16/10] overflow-hidden rounded-xl border border-outline-variant bg-surface-container-low";

const LABEL =
  "absolute left-3 top-3 rounded-full bg-surface/90 px-2.5 py-1 text-[11px] font-medium text-on-surface-variant";

/**
 * The property's street-level exterior and its aerial context, shown side by
 * side above the AI verdict.
 *
 * Both tiles are pinned to 16:10 because both sources render at 640x400 — so
 * `object-cover` never crops, and the Google attribution keeps its clearance.
 *
 * Degrades in both directions: no Street View panorama (common for rural and
 * new-construction addresses) drops that tile, a missing Mapbox token drops the
 * aerial tile, and neither available renders nothing at all rather than an
 * empty frame.
 */
export function PropertyImagery({ lat, lon, address }: PropertyImageryProps) {
  // An empty address must not reach Google as a literal lookup string; the
  // alt-text fallback below is for humans, not for panorama selection.
  const lookupAddress = address.trim() || undefined;
  const { data } = usePropertyImagery(lat, lon, lookupAddress);
  const label = lookupAddress ?? "this property";

  if (lat == null || lon == null) return null;

  const streetUrl = data?.available ? data.url : null;
  const aerialUrl = buildAerialUrl(lat, lon);

  if (!streetUrl && !aerialUrl) return null;

  return (
    <div
      data-property-imagery
      className="grid grid-cols-1 gap-3 sm:grid-cols-2"
    >
      {streetUrl && (
        <figure className={TILE}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={streetUrl}
            alt={`Street View of ${label}`}
            className="block h-full w-full object-cover"
          />
          <figcaption className={LABEL}>Street</figcaption>
          {/* Google requires visible, unobscured attribution on Street View
              imagery. The scrim guarantees contrast over arbitrary photo
              content — a drop shadow alone is not reliable against bright
              skies or white siding. */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-3 pt-6 pb-2">
            <span className="text-[11px] font-medium text-white">
              Google Maps
            </span>
          </div>
        </figure>
      )}

      {aerialUrl && (
        <figure className={TILE}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={aerialUrl}
            alt={`Aerial view of ${label}`}
            className="block h-full w-full object-cover"
          />
          <figcaption className={LABEL}>Aerial</figcaption>
          {/* Mapbox burns its own attribution into the raster — see buildAerialUrl. */}
        </figure>
      )}
    </div>
  );
}
