/**
 * Cover page of the PDF / share view. Editorial layout:
 * - Eyebrow ("PREPARED · date") + address masthead
 * - Grade ring + AI verdict prose (drop-cap)
 * - 4-up KPI band
 * - Inputs table (compact 4-col)
 * - 3-up strategy comparison cards + commentary callout
 *
 * All data comes from the saved snapshot — no live calls.
 */

import { fmtPct, fmtUsd, fmtRatio } from "@/app/analyzer/lib/format-helpers";
import type {
  RentalResult,
  FlipResult,
  BrrrrResult,
} from "@propertyiq/analyzer-core";
import { GradeRingLarge } from "./components/GradeRingLarge";
import { KpiBand } from "./components/KpiBand";
import { InputsTable } from "./components/InputsTable";

interface CoverProps {
  preparedDate: string; // already formatted (YYYY-MM-DD)
  addressFull: string | null;
  addressCity: string | null;
  addressState: string | null;
  addressZip: string | null;
  /** Letter grade from saved grading.data.letter, else derived from verdict. */
  gradeLetter: "A" | "B" | "C" | "D" | "F";
  gradeQualifier?: string;
  /** Pre-awaited AI verdict prose. */
  verdictNarrative: string | null;
  rental: Partial<RentalResult>;
  flip: FlipResult | null;
  brrrr: BrrrrResult | null;
  bestStrategy?: "buyAndHold" | "flip" | "brrrr";
  /** AI strategy commentary text. */
  strategyNarrative: string | null;
  input: Record<string, unknown>;
  assumptions?: Record<string, unknown>;
  arvLocal?: number | null;
  rehabBudget?: number | null;
  propertyClass?: string | null;
  /** Computed expense rollup — needed for OpEx row in the Inputs table. */
  expense?: {
    opexMonthly?: number | null;
    debtServiceMonthly?: number | null;
  };
}

export function ReadonlyCoverPage(p: CoverProps) {
  const headingLine1 = primaryAddressLine(p.addressFull, p.addressCity);
  const headingLine2 = secondaryAddressLine(
    p.addressFull,
    p.addressCity,
    p.addressState,
    p.addressZip,
  );

  const fracPct = (v: number | null | undefined) =>
    v == null ? null : v / 100;
  const kpis = [
    { label: "Cap Rate", value: fmtPct(fracPct(p.rental.capRatePct)) },
    {
      label: "Cashflow",
      value:
        p.rental.cashflowMonthly != null
          ? `${fmtUsd(p.rental.cashflowMonthly)}/mo`
          : "—",
    },
    { label: "DSCR", value: fmtRatio(p.rental.dscr ?? null) },
    { label: "Cash-on-cash", value: fmtPct(fracPct(p.rental.cashOnCashPct)) },
  ];

  return (
    <section className="pdf-page stack">
      <div>
        <p className="type-eyebrow">PREPARED · {p.preparedDate}</p>
        <h1 className="type-masthead">{headingLine1}</h1>
        {headingLine2 && (
          <p
            className="type-body"
            style={{ marginTop: 2, color: "var(--pdf-ink-soft)" }}
          >
            {headingLine2}
          </p>
        )}
      </div>

      {/* Grade + verdict prose */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "70pt 1fr",
          gap: "16pt",
          alignItems: "start",
        }}
      >
        <GradeRingLarge
          letter={p.gradeLetter}
          qualifier={p.gradeQualifier}
          size={60}
        />
        <p className="type-narrative has-dropcap">
          {p.verdictNarrative ?? defaultVerdictText(p)}
        </p>
      </div>

      <KpiBand items={kpis} />

      <InputsTable
        input={p.input as Parameters<typeof InputsTable>[0]["input"]}
        expense={p.expense}
        arvLocal={p.arvLocal}
        rehabBudget={p.rehabBudget}
        propertyClass={p.propertyClass}
      />

      {/* Strategy comparison — 3-up */}
      <div>
        <h2 className="type-h2">Strategy Comparison</h2>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: "10pt",
          }}
        >
          <StrategyCard
            title="Buy & Hold"
            isBest={p.bestStrategy === "buyAndHold"}
            heroLabel="Cap Rate"
            heroValue={fmtPct(fracPct(p.rental.capRatePct))}
            stats={[
              {
                label: "Cashflow/mo",
                value: fmtUsd(p.rental.cashflowMonthly ?? null),
              },
              { label: "DSCR", value: fmtRatio(p.rental.dscr ?? null) },
              { label: "NOI/yr", value: fmtUsd(p.rental.noiAnnual ?? null) },
            ]}
          />
          {p.flip ? (
            <StrategyCard
              title="Fix & Flip"
              isBest={p.bestStrategy === "flip"}
              heroLabel="ROI"
              heroValue={fmtPct(fracPct(p.flip.projectedRoiPct))}
              stats={[
                {
                  label: "Profit",
                  value: fmtUsd(p.flip.projectedProfit ?? null),
                },
                { label: "70% MAO", value: fmtUsd(p.flip.mao70 ?? null) },
              ]}
            />
          ) : (
            <EmptyCard title="Fix & Flip" />
          )}
          {p.brrrr ? (
            <StrategyCard
              title="BRRRR"
              isBest={p.bestStrategy === "brrrr"}
              heroLabel="Score"
              heroValue={p.brrrr.score != null ? p.brrrr.score.toFixed(1) : "—"}
              stats={[
                {
                  label: "Refi cash-out",
                  value: fmtUsd(p.brrrr.refinanceCashOut ?? null),
                },
                {
                  label: "Cash left",
                  value: fmtUsd(p.brrrr.remainingCashInDeal ?? null),
                },
              ]}
            />
          ) : (
            <EmptyCard title="BRRRR" />
          )}
        </div>
      </div>
    </section>
  );
}

interface StrategyCardProps {
  title: string;
  isBest?: boolean;
  heroLabel: string;
  heroValue: string;
  stats: Array<{ label: string; value: string }>;
}

function StrategyCard(p: StrategyCardProps) {
  return (
    <div className={`pdf-card ${p.isBest ? "pdf-card--best" : ""}`}>
      {p.isBest && <span className="badge">★ Best play</span>}
      <p className="type-label">{p.title}</p>
      <p className="type-label" style={{ marginTop: 6 }}>
        {p.heroLabel}
      </p>
      <p className="type-metric-md">{p.heroValue}</p>
      <div style={{ marginTop: 6 }}>
        {p.stats.map((s) => (
          <div
            key={s.label}
            style={{
              display: "flex",
              justifyContent: "space-between",
              padding: "2pt 0",
              borderTop: "1px solid var(--pdf-rule)",
            }}
          >
            <span className="type-label">{s.label}</span>
            <span className="type-metric-sm">{s.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function EmptyCard({ title }: { title: string }) {
  return (
    <div className="pdf-card" style={{ opacity: 0.55 }}>
      <p className="type-label">{title}</p>
      <p className="type-body" style={{ marginTop: 6 }}>
        Not modeled for this deal.
      </p>
    </div>
  );
}

function primaryAddressLine(full: string | null, city: string | null): string {
  if (full && full.includes(",")) {
    return full.split(",")[0].trim();
  }
  return full ?? city ?? "Untitled analysis";
}

function secondaryAddressLine(
  full: string | null,
  city: string | null,
  state: string | null,
  zip: string | null,
): string | null {
  if (full && full.includes(",")) {
    return full.substring(full.indexOf(",") + 1).trim();
  }
  const parts = [city, state, zip].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : null;
}

function defaultVerdictText(p: CoverProps): string {
  const cap = p.rental.capRatePct;
  const cf = p.rental.cashflowMonthly;
  const dscr = p.rental.dscr;
  const capText = cap != null ? `${cap.toFixed(1)}% cap rate` : "cap rate";
  const cfText =
    cf != null
      ? cf >= 0
        ? `positive ${fmtUsd(cf)}/mo cashflow`
        : `negative ${fmtUsd(cf)}/mo cashflow`
      : "cashflow";
  const dscrText =
    dscr != null ? `DSCR ${dscr.toFixed(2)}` : "DSCR not yet computed";
  return `This property models to a ${capText} with ${cfText} and ${dscrText}. Detailed strategy comparison and market context follow.`;
}
