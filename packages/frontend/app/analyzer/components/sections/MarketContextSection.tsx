"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { SectionWrapper } from "./SectionWrapper";
import { AIAnnotation } from "../ai/AIAnnotation";
import { MetricBlock } from "../primitives/MetricBlock";
import { useMarketContext } from "@/lib/data";
import type { MarketContextChain } from "@/lib/data/fetchers/analyzer";

type PillLevel = "zip" | "county" | "metro";

interface MarketContextSectionProps {
  /** Parent chain from /api/analyzer/market-context. Drives pill availability + URL. */
  chain: MarketContextChain | null;
  /** Level the backend originally resolved to — sets initial pill when metro absent. */
  initialGeoLevel: "zip" | "county" | "metro" | "state" | null;
  /** Snapshot fallbacks — saved/shared routes only, no live geo. */
  fallbackPiq?: number | null;
  fallbackHomeValue?: number | null;
  fallbackRentIndex?: number | null;
  fallbackMarketHeat?: number | null;
  fallbackNetMigration?: number | null;
  aiText?: string | null;
  aiIsStale?: boolean;
  onRefreshAi?: () => void;
}

const PILL_ORDER: PillLevel[] = ["metro", "county", "zip"];
const PILL_LABEL: Record<PillLevel, string> = {
  metro: "Metro",
  county: "County",
  zip: "ZIP",
};

function idForLevel(
  chain: MarketContextChain | null,
  level: PillLevel,
): string | null {
  if (!chain) return null;
  if (level === "zip") return chain.zip ?? null;
  if (level === "county") return chain.county_fips ?? null;
  return chain.cbsa_code ?? null;
}

function buildMarketUrl(level: PillLevel, id: string | null): string | null {
  if (!id) return null;
  if (level === "zip") return `/markets/zip/${id}`;
  if (level === "county") return `/markets/county/${id}`;
  return `/markets/${id}`;
}

/** Most-reliable PIQ first: Metro > County > ZIP. Falls back to backend's resolved level. */
function pickDefaultPill(
  chain: MarketContextChain | null,
  initial: MarketContextSectionProps["initialGeoLevel"],
): PillLevel {
  if (chain?.cbsa_code) return "metro";
  if (chain?.county_fips) return "county";
  if (chain?.zip) return "zip";
  if (initial === "metro" || initial === "county" || initial === "zip") {
    return initial;
  }
  return "metro";
}

/** Build the analyzer market-context query params for a given pill level. */
function paramsForPill(
  level: PillLevel,
  id: string,
): { zip?: string; county_fips?: string; cbsa_code?: string } {
  if (level === "zip") return { zip: id };
  if (level === "county") return { county_fips: id };
  return { cbsa_code: id };
}

export function MarketContextSection({
  chain,
  initialGeoLevel,
  fallbackPiq,
  fallbackHomeValue,
  fallbackRentIndex,
  fallbackMarketHeat,
  fallbackNetMigration,
  aiText,
  aiIsStale,
  onRefreshAi,
}: MarketContextSectionProps) {
  const availablePills = useMemo<PillLevel[]>(
    () => PILL_ORDER.filter((lvl) => idForLevel(chain, lvl) != null),
    [chain],
  );
  const [activePill, setActivePill] = useState<PillLevel>(() =>
    pickDefaultPill(chain, initialGeoLevel),
  );
  const effectivePill: PillLevel =
    availablePills.includes(activePill) || availablePills.length === 0
      ? activePill
      : availablePills[0];
  const activeId = idForLevel(chain, effectivePill);

  // Single call to the analyzer's own market-context endpoint at the selected
  // pill level. Backend handles metric resolution + fallback chains and
  // returns all 5 metrics + provenance in one round trip. Pill switch = new
  // queryKey = new fetch (React Query caches each level independently).
  const ctxParams = activeId ? paramsForPill(effectivePill, activeId) : {};
  const ctx = useMarketContext({ ...ctxParams, enabled: !!activeId });
  const data = ctx.data;

  // Live values when fetch resolved; snapshot fallbacks for saved/shared routes
  // (chain=null → useMarketContext disabled → data=null → use fallbacks).
  const piqScore = data?.piq_score?.value ?? fallbackPiq ?? null;
  const homeValue = data?.home_value?.value ?? fallbackHomeValue ?? null;
  const rentIndex = data?.rent_index?.value ?? fallbackRentIndex ?? null;
  const marketHeat = data?.market_heat?.value ?? fallbackMarketHeat ?? null;
  const netMigration =
    data?.net_migration?.value ?? fallbackNetMigration ?? null;
  const piqLabel = data?.piq_score?.label ?? null;

  const url = buildMarketUrl(effectivePill, activeId);
  const toNum = (v: number | null) => (v == null ? Number.NaN : v);
  const pillLabel = PILL_LABEL[effectivePill];

  return (
    <SectionWrapper
      id="market_context"
      title="Market Context"
      onRefresh={onRefreshAi}
      aiAnnotation={
        <AIAnnotation
          text={aiText}
          isStale={aiIsStale}
          onRefresh={onRefreshAi}
        />
      }
    >
      {availablePills.length > 0 && (
        <GeoPills
          pills={availablePills}
          active={effectivePill}
          onChange={setActivePill}
        />
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        <TileLink href={url}>
          <MetricBlock
            label="PIQ Score"
            value={toNum(piqScore)}
            format="number"
            decimals={0}
            size="md"
            variant="score"
            subLabel={piqLabel ?? pillLabel}
          />
        </TileLink>

        <TileLink href={url}>
          <MetricBlock
            label="Home Value"
            value={toNum(homeValue)}
            format="currency"
            size="md"
            subLabel={data?.home_value?.source ?? pillLabel}
          />
        </TileLink>

        <TileLink href={url}>
          <MetricBlock
            label="Rent Index"
            value={toNum(rentIndex)}
            format="currency"
            size="md"
            subLabel={data?.rent_index?.source ?? pillLabel}
          />
        </TileLink>

        <TileLink href={url}>
          <MetricBlock
            label="Market Heat"
            value={toNum(marketHeat)}
            format="number"
            decimals={1}
            size="md"
            variant="directional"
            threshold={{ good: 70, warning: 40 }}
            subLabel={data?.market_heat?.source ?? pillLabel}
          />
        </TileLink>

        <TileLink href={url}>
          <MetricBlock
            label="Net Migration"
            value={toNum(netMigration)}
            format="number"
            decimals={0}
            size="md"
            variant="directional"
            subLabel={data?.net_migration?.source ?? pillLabel}
          />
        </TileLink>
      </div>
    </SectionWrapper>
  );
}

/** Pill row mirroring StrategyChips for visual unity. */
function GeoPills({
  pills,
  active,
  onChange,
}: {
  pills: PillLevel[];
  active: PillLevel;
  onChange: (lvl: PillLevel) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="Market context geography"
      className="flex items-center gap-2 flex-wrap mb-3"
      data-geo-pills
    >
      <span className="text-xs uppercase font-semibold text-on-surface-variant mr-1">
        View at
      </span>
      {pills.map((p) => {
        const isActive = p === active;
        return (
          <button
            key={p}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(p)}
            className="rounded-full px-3 py-1 text-xs font-semibold transition-colors"
            style={{
              background: isActive ? "var(--md-primary)" : "transparent",
              color: isActive
                ? "var(--md-on-primary)"
                : "var(--md-on-surface-variant)",
              border: isActive
                ? "0.5px solid var(--md-primary)"
                : "0.5px solid var(--md-outline-variant)",
              letterSpacing: "0.02em",
            }}
          >
            {PILL_LABEL[p]}
          </button>
        );
      })}
    </div>
  );
}

function TileLink({
  href,
  children,
}: {
  href: string | null;
  children: React.ReactNode;
}) {
  const shellClass =
    "block rounded-xl border border-outline-variant bg-surface-container-low p-3 transition-colors hover:border-primary hover:bg-surface focus:outline-none focus:border-primary";
  if (!href) {
    return <div className={shellClass}>{children}</div>;
  }
  return (
    <Link href={href} className={shellClass}>
      {children}
    </Link>
  );
}
