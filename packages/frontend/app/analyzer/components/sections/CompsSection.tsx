"use client";

import { useMemo, useState } from "react";
import { Map, Marker, Popup } from "react-map-gl/mapbox";
import "mapbox-gl/dist/mapbox-gl.css";
import { SectionWrapper } from "./SectionWrapper";
import { AIAnnotation } from "../ai/AIAnnotation";
import { CompsDistribution } from "../primitives/CompsDistribution";
import type { Comp } from "../primitives/CompsDistribution";
import { CompsTable, type CompRow } from "./CompsTable";
import { piq } from "../primitives/piqTokens";

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
  subjectAddress?: string | null;
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

function abbreviateAddress(addr: string | null | undefined, max = 26): string {
  if (!addr) return "Subject";
  const first = addr.split(",")[0]?.trim() ?? addr;
  return first.length > max ? `${first.slice(0, max - 1)}…` : first;
}

interface HoveredComp {
  key: string;
  lat: number;
  lon: number;
  kind: "sale" | "rent";
  address: string;
  price?: number | null;
  rent?: number | null;
  distance?: number;
}

function CompMarker({
  comp,
  kind,
  keyId,
  hovered,
  onHover,
  onLeave,
}: {
  comp: CompPin;
  kind: "sale" | "rent";
  keyId: string;
  hovered: boolean;
  onHover: () => void;
  onLeave: () => void;
}) {
  const size = hovered ? 12 : 8;
  const fill = kind === "sale" ? piq.green : piq.amber;
  return (
    <Marker
      latitude={comp.lat as number}
      longitude={comp.lon as number}
      anchor="center"
    >
      <div
        onMouseEnter={onHover}
        onMouseLeave={onLeave}
        data-comp-marker={keyId}
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          background: fill,
          border: "1.5px solid #FFFFFF",
          boxShadow: hovered
            ? "0 2px 8px rgba(15,23,42,0.25)"
            : "0 1px 2px rgba(15,23,42,0.15)",
          cursor: "pointer",
          transition:
            "width 150ms ease, height 150ms ease, box-shadow 150ms ease",
        }}
      />
    </Marker>
  );
}

export function CompsSection({
  subjectLat,
  subjectLon,
  subjectAddress,
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

  const [hovered, setHovered] = useState<HoveredComp | null>(null);

  // Distribution data: comps with a derivable price/sqft.
  const distributionComps: Comp[] = useMemo(
    () =>
      salesComps
        .map((c, i) => {
          if (!c.price || !c.sqft || c.sqft <= 0) return null;
          return {
            id: `s${i}`,
            pricePerSqft: c.price / c.sqft,
            address: c.address,
          } as Comp;
        })
        .filter((c): c is Comp => c !== null),
    [salesComps],
  );

  // Table rows: cap at 6 sales + 6 rentals to keep the expanded view scannable.
  const tableRows: CompRow[] = useMemo(
    () => [
      ...salesComps.slice(0, 6).map((c) => ({ ...c, kind: "sale" as const })),
      ...rentalComps.slice(0, 6).map((c) => ({ ...c, kind: "rent" as const })),
    ],
    [salesComps, rentalComps],
  );

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
        <div data-comps-distribution>
          <h4
            className="text-xs uppercase font-semibold mb-2"
            style={{ color: piq.textMuted, letterSpacing: "0.08em" }}
          >
            Price-per-sqft distribution
          </h4>
          {distributionComps.length > 0 && yourPricePerSqft > 0 ? (
            <CompsDistribution
              comps={distributionComps}
              subjectPricePerSqft={yourPricePerSqft}
              subjectAddress={subjectAddress ?? undefined}
            />
          ) : (
            <div
              className="rounded-xl text-center py-12 px-4"
              style={{
                background: piq.canvas,
                border: `0.5px dashed ${piq.border}`,
                color: piq.textMuted,
                fontSize: "13px",
              }}
            >
              No sales comps with valid price/sqft yet — fetch property data to
              populate.
            </div>
          )}
        </div>
        {showMap ? (
          <div
            data-comps-map
            className="h-72 rounded-xl overflow-hidden"
            style={{ border: `0.5px solid ${piq.border}` }}
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
              {/* Subject pill */}
              <Marker
                latitude={subjectLat as number}
                longitude={subjectLon as number}
                anchor="bottom"
              >
                <div
                  style={{
                    background: piq.indigo,
                    color: "#FFFFFF",
                    padding: "4px 10px",
                    borderRadius: 999,
                    fontSize: "11px",
                    fontWeight: 600,
                    letterSpacing: "0.01em",
                    whiteSpace: "nowrap",
                    boxShadow: "0 2px 8px rgba(57, 73, 171, 0.35)",
                    pointerEvents: "none",
                  }}
                >
                  {abbreviateAddress(subjectAddress)}
                </div>
              </Marker>

              {salesComps
                .filter((c) => isCoord(c.lat) && isCoord(c.lon))
                .map((c, i) => {
                  const key = `s${i}`;
                  return (
                    <CompMarker
                      key={key}
                      comp={c}
                      kind="sale"
                      keyId={key}
                      hovered={hovered?.key === key}
                      onHover={() =>
                        setHovered({
                          key,
                          lat: c.lat as number,
                          lon: c.lon as number,
                          kind: "sale",
                          address: c.address,
                          price: c.price,
                          distance: c.distance,
                        })
                      }
                      onLeave={() => setHovered(null)}
                    />
                  );
                })}

              {rentalComps
                .filter((c) => isCoord(c.lat) && isCoord(c.lon))
                .map((c, i) => {
                  const key = `r${i}`;
                  return (
                    <CompMarker
                      key={key}
                      comp={c}
                      kind="rent"
                      keyId={key}
                      hovered={hovered?.key === key}
                      onHover={() =>
                        setHovered({
                          key,
                          lat: c.lat as number,
                          lon: c.lon as number,
                          kind: "rent",
                          address: c.address,
                          rent: c.rent,
                          distance: c.distance,
                        })
                      }
                      onLeave={() => setHovered(null)}
                    />
                  );
                })}

              {hovered && (
                <Popup
                  latitude={hovered.lat}
                  longitude={hovered.lon}
                  closeButton={false}
                  closeOnClick={false}
                  anchor="bottom"
                  offset={14}
                >
                  <div
                    style={{
                      background: piq.surface,
                      border: `0.5px solid ${piq.border}`,
                      padding: "8px 12px",
                      borderRadius: 8,
                      fontSize: "12px",
                      color: piq.textPrimary,
                      boxShadow: "0 4px 14px rgba(15, 23, 42, 0.08)",
                      minWidth: 160,
                      maxWidth: 260,
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    <div style={{ fontWeight: 600 }}>{hovered.address}</div>
                    <div
                      style={{
                        color: piq.textMuted,
                        marginTop: 4,
                        fontSize: "11px",
                      }}
                    >
                      {hovered.kind === "sale"
                        ? hovered.price
                          ? `$${Math.round(hovered.price / 1000)}K`
                          : "Sale"
                        : hovered.rent
                          ? `$${hovered.rent}/mo`
                          : "Rent"}
                      {hovered.distance != null &&
                        ` · ${hovered.distance.toFixed(1)}mi`}
                    </div>
                  </div>
                </Popup>
              )}
            </Map>
          </div>
        ) : (
          <div
            data-comps-map-empty
            className="h-72 rounded-xl flex items-center justify-center text-xs text-center px-4"
            style={{
              border: `0.5px dashed ${piq.border}`,
              background: piq.canvas,
              color: piq.textMuted,
            }}
          >
            {!mapboxToken
              ? "Map unavailable — NEXT_PUBLIC_MAPBOX_TOKEN not configured."
              : "Map unavailable — geocode the subject address to enable."}
          </div>
        )}
      </div>

      <CompsTable rows={tableRows} />
    </SectionWrapper>
  );
}
