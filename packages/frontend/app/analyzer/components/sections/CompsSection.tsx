"use client";
import { SectionWrapper } from "./SectionWrapper";
import { DistributionViolinChart } from "../charts/DistributionViolinChart";
import { AIAnnotation } from "../ai/AIAnnotation";
import { Map, Marker } from "react-map-gl/mapbox";
import "mapbox-gl/dist/mapbox-gl.css";

export interface CompPin {
  address: string;
  /** lat/lon required for map pins; if either is null the pin is skipped. */
  lat?: number | null;
  lon?: number | null;
  price?: number | null;
  rent?: number | null;
  beds?: number | null;
  baths?: number | null;
  sqft?: number | null;
  distance?: number;
}

interface CompsSectionProps {
  /** Subject lat/lon — when null/missing, the map is hidden and only chart+table render. */
  subjectLat?: number | null;
  subjectLon?: number | null;
  pricePerSqftValues: number[];
  yourPricePerSqft: number;
  salesComps: CompPin[];
  rentalComps: CompPin[];
  /** Mapbox public token; if empty/undefined the map is hidden. */
  mapboxToken?: string;
  aiText?: string | null;
  aiIsStale?: boolean;
  onRefreshAi?: () => void;
}

const isCoord = (v: number | null | undefined): v is number =>
  typeof v === "number" && Number.isFinite(v);

export function CompsSection({
  subjectLat,
  subjectLon,
  pricePerSqftValues,
  yourPricePerSqft,
  salesComps,
  rentalComps,
  mapboxToken,
  aiText,
  aiIsStale,
  onRefreshAi,
}: CompsSectionProps) {
  const showMap =
    Boolean(mapboxToken) && isCoord(subjectLat) && isCoord(subjectLon);
  const tableRows = [
    ...salesComps.slice(0, 6).map((c) => ({ ...c, kind: "sale" as const })),
    ...rentalComps.slice(0, 6).map((c) => ({ ...c, kind: "rent" as const })),
  ];

  return (
    <SectionWrapper
      id="comps"
      title="Comparable Sales & Rentals"
      onRefresh={onRefreshAi}
      aiAnnotation={
        <AIAnnotation
          text={aiText}
          isStale={aiIsStale}
          onRefresh={onRefreshAi}
        />
      }
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div data-comps-violin>
          <h4 className="text-xs uppercase font-semibold text-on-surface-variant mb-2">
            Price-per-sqft distribution
          </h4>
          <DistributionViolinChart
            values={pricePerSqftValues}
            yourValue={yourPricePerSqft}
          />
        </div>
        {showMap ? (
          <div
            data-comps-map
            className="h-72 rounded-xl overflow-hidden border border-outline-variant"
          >
            <Map
              mapboxAccessToken={mapboxToken}
              initialViewState={{
                latitude: subjectLat as number,
                longitude: subjectLon as number,
                zoom: 12,
              }}
              mapStyle="mapbox://styles/mapbox/light-v11"
              style={{ width: "100%", height: "100%" }}
            >
              <Marker
                latitude={subjectLat as number}
                longitude={subjectLon as number}
                color="var(--md-primary)"
              />
              {salesComps
                .filter((c) => isCoord(c.lat) && isCoord(c.lon))
                .map((c, i) => (
                  <Marker
                    key={`s${i}`}
                    latitude={c.lat as number}
                    longitude={c.lon as number}
                    color="var(--md-tertiary)"
                  />
                ))}
              {rentalComps
                .filter((c) => isCoord(c.lat) && isCoord(c.lon))
                .map((c, i) => (
                  <Marker
                    key={`r${i}`}
                    latitude={c.lat as number}
                    longitude={c.lon as number}
                    color="var(--md-warning)"
                  />
                ))}
            </Map>
          </div>
        ) : (
          <div
            data-comps-map-empty
            className="h-72 rounded-xl border border-dashed border-outline-variant flex items-center justify-center text-xs text-on-surface-variant text-center px-4"
          >
            {!mapboxToken
              ? "Map unavailable — NEXT_PUBLIC_MAPBOX_TOKEN not configured."
              : "Map unavailable — geocode the subject address to enable."}
          </div>
        )}
      </div>
      <table data-comps-table className="w-full text-xs mt-3">
        <thead>
          <tr className="text-left text-on-surface-variant border-b border-outline-variant">
            <th>Type</th>
            <th>Address</th>
            <th>BR/BA</th>
            <th>SqFt</th>
            <th>Price/Rent</th>
            <th>Dist</th>
          </tr>
        </thead>
        <tbody>
          {tableRows.map((c, i) => (
            <tr
              key={i}
              data-comp-row
              className="border-b border-outline-variant/40"
            >
              <td className="font-mono text-[10px] uppercase text-on-surface-variant">
                {c.kind}
              </td>
              <td className="truncate max-w-[160px]">{c.address}</td>
              <td className="font-mono">
                {c.beds ?? "—"}/{c.baths ?? "—"}
              </td>
              <td className="font-mono">{c.sqft ?? "—"}</td>
              <td className="font-mono">
                {c.kind === "sale"
                  ? c.price
                    ? `$${Math.round(c.price / 1000)}K`
                    : "—"
                  : c.rent
                    ? `$${c.rent}/mo`
                    : "—"}
              </td>
              <td className="font-mono">
                {c.distance != null ? `${c.distance.toFixed(1)}mi` : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </SectionWrapper>
  );
}
