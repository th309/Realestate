"use client";

import type { RentcastPropertyRecord } from "@/lib/data";

interface PropertyRecordCardProps {
  record: RentcastPropertyRecord;
}

const NA = "—"; // em dash

function fmtUsd(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return NA;
  return `$${Math.round(n).toLocaleString()}`;
}

function fmtNumber(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return NA;
  return n.toLocaleString();
}

function fmtDate(s: string | null | undefined): string {
  if (!s) return NA;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function Row({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  const isEmpty = value == null || value === NA || value === "";
  return (
    <div className="flex items-baseline justify-between gap-3 py-1 text-xs">
      <span className="text-on-surface-variant whitespace-nowrap">{label}</span>
      <span
        className={[
          "text-right text-on-surface tabular-nums",
          mono ? "font-mono" : "",
          isEmpty ? "text-on-surface-variant/50" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {isEmpty ? NA : value}
      </span>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-0.5">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-on-surface-variant pb-1">
        {title}
      </div>
      <div>{children}</div>
    </div>
  );
}

/**
 * PropertyRecordCard — left-column display of every field RentCast returns
 * for the subject property. Grouped into Identity, Physical, Last Sale,
 * Taxes, HOA & Features, Ownership, History. Null fields render as em-dash.
 *
 * Renders nothing structural on empty record (every field null) so the
 * caller can decide whether to show a placeholder banner.
 */
export function PropertyRecordCard({ record }: PropertyRecordCardProps) {
  const r = record;
  const fullAddress = r.formattedAddress ?? r.addressLine1 ?? null;
  const hasAnyValue = Object.values(r).some((v) => {
    if (v == null) return false;
    if (Array.isArray(v)) return v.length > 0;
    return true;
  });
  if (!hasAnyValue) return null;

  const latestTax = r.propertyTaxes[0] ?? null;
  const latestAssessment = r.taxAssessments[0] ?? null;

  return (
    <section
      data-property-record-card
      className="rounded-2xl bg-surface border border-outline-variant p-4 space-y-4 shadow-sm"
    >
      <header>
        <div className="text-[10px] font-semibold uppercase tracking-wide text-primary mb-1">
          RentCast Property Record
        </div>
        {fullAddress && (
          <div
            className="text-sm font-semibold text-on-surface leading-snug"
            title={fullAddress}
          >
            {fullAddress}
          </div>
        )}
        {r.county && (
          <div className="text-[11px] text-on-surface-variant">
            {r.county} County
            {r.countyFips ? ` (FIPS ${r.countyFips})` : ""}
            {r.subdivision ? ` · ${r.subdivision}` : ""}
          </div>
        )}
      </header>

      <Section title="Physical">
        <Row label="Type" value={r.propertyType} />
        <Row label="Beds" value={fmtNumber(r.beds)} mono />
        <Row label="Baths" value={fmtNumber(r.baths)} mono />
        <Row
          label="Sqft"
          value={r.sqft != null ? r.sqft.toLocaleString() : null}
          mono
        />
        <Row
          label="Lot size"
          value={
            r.lotSize != null ? `${r.lotSize.toLocaleString()} sqft` : null
          }
          mono
        />
        <Row label="Year built" value={fmtNumber(r.yearBuilt)} mono />
        <Row label="Architecture" value={r.architectureType} />
        <Row label="Floors" value={fmtNumber(r.floorCount)} mono />
        <Row label="Units" value={fmtNumber(r.unitCount)} mono />
        <Row
          label="Garage"
          value={
            r.garage == null
              ? null
              : r.garage
                ? `Yes${r.garageSpaces ? ` (${r.garageSpaces})` : ""}`
                : "No"
          }
        />
      </Section>

      <Section title="Last Sale">
        <Row label="Date" value={fmtDate(r.lastSaleDate)} />
        <Row label="Price" value={fmtUsd(r.lastSalePrice)} mono />
      </Section>

      <Section title="Taxes & Assessment">
        <Row
          label={
            latestTax ? `${latestTax.year} property tax` : "Latest property tax"
          }
          value={fmtUsd(latestTax?.total)}
          mono
        />
        <Row
          label={
            latestAssessment
              ? `${latestAssessment.year} assessment`
              : "Latest assessment"
          }
          value={fmtUsd(latestAssessment?.value)}
          mono
        />
        <Row label="Land value" value={fmtUsd(latestAssessment?.land)} mono />
        <Row
          label="Improvements"
          value={fmtUsd(latestAssessment?.improvements)}
          mono
        />
      </Section>

      <Section title="HOA & Records">
        <Row
          label="HOA fee"
          value={r.hoaFee != null ? `${fmtUsd(r.hoaFee)}/mo` : null}
          mono
        />
        <Row label="Assessor ID" value={r.assessorID} mono />
        <Row label="Legal" value={r.legalDescription} />
      </Section>

      <Section title="Ownership">
        <Row
          label="Owner"
          value={
            r.ownerNames && r.ownerNames.length > 0
              ? r.ownerNames.join(", ")
              : null
          }
        />
        <Row label="Type" value={r.ownerType} />
        <Row
          label="Occupied by owner"
          value={
            r.ownerOccupied == null ? null : r.ownerOccupied ? "Yes" : "No"
          }
        />
      </Section>

      <Section title="Location">
        <Row
          label="Lat / Lon"
          value={
            r.lat != null && r.lon != null
              ? `${r.lat.toFixed(5)}, ${r.lon.toFixed(5)}`
              : null
          }
          mono
        />
      </Section>

      {r.saleHistory.length > 0 && (
        <Section title={`Sale History (${r.saleHistory.length})`}>
          <ul className="space-y-1">
            {r.saleHistory.map((h, idx) => (
              <li
                key={`${h.date}-${idx}`}
                className="flex items-baseline justify-between gap-3 text-xs"
              >
                <span className="text-on-surface-variant whitespace-nowrap">
                  {fmtDate(h.date)} · {h.event}
                </span>
                <span className="font-mono text-on-surface tabular-nums">
                  {fmtUsd(h.price)}
                </span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {r.taxAssessments.length > 1 && (
        <Section title={`Assessment History (${r.taxAssessments.length})`}>
          <ul className="space-y-1">
            {r.taxAssessments.map((t) => (
              <li
                key={t.year}
                className="flex items-baseline justify-between gap-3 text-xs"
              >
                <span className="text-on-surface-variant whitespace-nowrap">
                  {t.year}
                </span>
                <span className="font-mono text-on-surface tabular-nums">
                  {fmtUsd(t.value)}
                </span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {r.propertyTaxes.length > 1 && (
        <Section title={`Property Tax History (${r.propertyTaxes.length})`}>
          <ul className="space-y-1">
            {r.propertyTaxes.map((t) => (
              <li
                key={t.year}
                className="flex items-baseline justify-between gap-3 text-xs"
              >
                <span className="text-on-surface-variant whitespace-nowrap">
                  {t.year}
                </span>
                <span className="font-mono text-on-surface tabular-nums">
                  {fmtUsd(t.total)}
                </span>
              </li>
            ))}
          </ul>
        </Section>
      )}
    </section>
  );
}
