"use client";

import { useState } from "react";
import { usePropertyImagery } from "@/lib/data";
import { buildAerialUrl } from "./buildAerialUrl";

type Mode = "street" | "aerial";

interface PropertyImageryProps {
  lat: number | null;
  lon: number | null;
  /** Resolved address, used for image alt text. */
  address: string;
}

/**
 * Hero media panel: the property's Street View exterior and its aerial context,
 * behind a two-option toggle. Only the active mode's image is requested, so a
 * user who never opens Aerial costs exactly one Street View call.
 *
 * Degrades in both directions — no panorama hides the Street tab, no Mapbox
 * token hides Aerial, and neither renders nothing at all rather than an empty box.
 */
export function PropertyImagery({ lat, lon, address }: PropertyImageryProps) {
  const { data } = usePropertyImagery(lat, lon);
  const [chosen, setChosen] = useState<Mode | null>(null);

  if (lat == null || lon == null) return null;

  const streetUrl = data?.available ? data.url : null;
  const aerialUrl = buildAerialUrl(lat, lon);

  if (!streetUrl && !aerialUrl) return null;

  // Availability arrives async, so derive the active mode rather than syncing
  // state in an effect.
  const mode: Mode = chosen ?? (streetUrl ? "street" : "aerial");
  const active = mode === "street" && streetUrl ? "street" : "aerial";

  return (
    <div
      data-property-imagery
      className="relative overflow-hidden rounded-xl border border-outline-variant bg-surface-container-low"
    >
      <div
        role="group"
        aria-label="Property imagery"
        className="absolute left-3 top-3 z-10 flex gap-1 rounded-full bg-surface/90 p-1 shadow-sm"
      >
        {streetUrl && (
          <button
            aria-pressed={active === "street"}
            onClick={() => setChosen("street")}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors duration-200 ${
              active === "street"
                ? "bg-primary text-on-primary"
                : "text-on-surface-variant"
            }`}
          >
            Street
          </button>
        )}
        {aerialUrl && (
          <button
            aria-pressed={active === "aerial"}
            onClick={() => setChosen("aerial")}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors duration-200 ${
              active === "aerial"
                ? "bg-primary text-on-primary"
                : "text-on-surface-variant"
            }`}
          >
            Aerial
          </button>
        )}
      </div>

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={(active === "street" ? streetUrl : aerialUrl) as string}
        alt={
          active === "street"
            ? `Street View of ${address}`
            : `Aerial view of ${address}`
        }
        className="block h-full w-full object-cover"
      />

      {/* Google requires visible, unobscured attribution on Street View imagery.
          The scrim guarantees contrast over arbitrary photo content — a drop
          shadow alone is not reliable against bright skies or white siding. */}
      {active === "street" && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-3 pt-6 pb-2">
          <span className="text-[11px] font-medium text-white">
            Google Maps
          </span>
        </div>
      )}
    </div>
  );
}
