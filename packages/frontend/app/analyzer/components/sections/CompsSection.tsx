"use client";
import { SectionWrapper } from "./SectionWrapper";
import { DistributionViolinChart } from "../charts/DistributionViolinChart";
import { AIAnnotation } from "../ai/AIAnnotation";
import { Map, Marker } from "react-map-gl/mapbox";
import "mapbox-gl/dist/mapbox-gl.css";

export interface CompPin {
  address: string;
  lat: number;
  lon: number;
  price?: number;
  rent?: number;
  beds?: number | null;
  baths?: number | null;
  sqft?: number | null;
  distance?: number;
}

interface CompsSectionProps {
  subjectLat: number;
  subjectLon: number;
  pricePerSqftValues: number[]; // population
  yourPricePerSqft: number; // marker
  salesComps: CompPin[];
  rentalComps: CompPin[];
  mapboxToken: string;
  aiText?: string | null;
  aiIsStale?: boolean;
  onRefreshAi?: () => void;
}

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
        <div
          data-comps-map
          className="h-72 rounded-xl overflow-hidden border border-outline-variant"
        >
          <Map
            mapboxAccessToken={mapboxToken}
            initialViewState={{
              latitude: subjectLat,
              longitude: subjectLon,
              zoom: 12,
            }}
            mapStyle="mapbox://styles/mapbox/light-v11"
            style={{ width: "100%", height: "100%" }}
          >
            <Marker
              latitude={subjectLat}
              longitude={subjectLon}
              color="var(--md-primary)"
            />
            {salesComps.map((c, i) => (
              <Marker
                key={`s${i}`}
                latitude={c.lat}
                longitude={c.lon}
                color="var(--md-tertiary)"
              />
            ))}
            {rentalComps.map((c, i) => (
              <Marker
                key={`r${i}`}
                latitude={c.lat}
                longitude={c.lon}
                color="var(--md-warning)"
              />
            ))}
          </Map>
        </div>
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
