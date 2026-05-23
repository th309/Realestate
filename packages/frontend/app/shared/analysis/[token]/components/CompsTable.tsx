import { fmtUsd } from "@/app/analyzer/lib/format-helpers";

interface CompRow {
  address?: string;
  price?: number | null;
  rent?: number | null;
  beds?: number | null;
  baths?: number | null;
  sqft?: number | null;
  distance?: number;
}

interface Props {
  comps: CompRow[];
  /** Print-friendly cap; defaults to 8 rows. */
  limit?: number;
}

/**
 * Tabular comparable-sales listing for page 4 of the PDF. Roboto Mono
 * numbers with tabular alignment, alternating-row warm paper background,
 * small-caps column headers. Replaces the interactive comp cards/tooltips
 * from the live view, which don't print well.
 */
export function CompsTable({ comps, limit = 8 }: Props) {
  const rows = comps.slice(0, limit);
  return (
    <table className="pdf-table">
      <thead>
        <tr>
          <th>Address</th>
          <th style={{ textAlign: "right" }}>Price</th>
          <th style={{ textAlign: "right" }}>$/sqft</th>
          <th style={{ textAlign: "right" }}>Beds</th>
          <th style={{ textAlign: "right" }}>Sqft</th>
          <th style={{ textAlign: "right" }}>Dist</th>
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 && (
          <tr>
            <td colSpan={6} className="label" style={{ textAlign: "center" }}>
              No comparable sales captured.
            </td>
          </tr>
        )}
        {rows.map((c, i) => {
          const ppsf =
            c.price != null && c.sqft != null && c.sqft > 0
              ? Math.round(c.price / c.sqft)
              : null;
          return (
            <tr key={i}>
              <td>{truncate(c.address ?? "—", 36)}</td>
              <td style={{ textAlign: "right" }}>{fmtUsd(c.price ?? null)}</td>
              <td style={{ textAlign: "right" }}>
                {ppsf != null ? `$${ppsf}` : "—"}
              </td>
              <td style={{ textAlign: "right" }}>{c.beds ?? "—"}</td>
              <td style={{ textAlign: "right" }}>
                {c.sqft != null ? c.sqft.toLocaleString() : "—"}
              </td>
              <td style={{ textAlign: "right" }}>
                {c.distance != null ? `${c.distance.toFixed(1)}mi` : "—"}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function truncate(s: string, n: number): string {
  return s.length <= n ? s : s.slice(0, n - 1) + "…";
}
