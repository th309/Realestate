"use client";
import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { SectionWrapper } from "./SectionWrapper";
import { MetricBlock } from "../primitives/MetricBlock";
import type { MarketContextChain } from "@/lib/data";
import { useMarketContextByGeo } from "../../lib/use-market-context-by-geo";

type PillLevel = "zip" | "county" | "metro";

interface MarketContextSectionProps {
  /** Parent chain from /api/analyzer/market-context. Drives pill availability + URL. */
  chain: MarketContextChain | null;
  /** Level the backend originally resolved to — sets initial pill when metro absent. */
  initialGeoLevel: "zip" | "county" | "metro" | "state" | null;
  /** Snapshot fallbacks — saved/shared routes only, no live geo. */
  fallbackPiq?: number | null;
  fallbackHomeValue?: number | null;
  fallbackHomeValueYoy?: number | null;
  fallbackRentIndex?: number | null;
  fallbackMarketHeat?: number | null;
  fallbackNetMigration?: number | null;
  /** Snapshot AI text — used on saved/shared routes where no live AI fetch
   *  is wired. Live flows pass `aiPayloadBase` + `aiEnabled` instead and the
   *  section runs one AI fetch per available geo so pill toggles are instant. */
  aiText?: string | null;
  aiIsStale?: boolean;
  aiIsLoading?: boolean;
  onRefreshAi?: () => void;
  /** Base payload (input/result/rentcast) for the live AI fetch. The section
   *  injects each geo's pill-aware MarketContext as the `piq` slice so the
   *  resulting annotation is geo-specific. Omit on saved/shared. */
  aiPayloadBase?: { input: unknown; result: unknown; rentcast: unknown };
  /** Pro + has-input gate from the parent. Combined with geo availability to
   *  decide whether to fire per-geo AI requests. */
  aiEnabled?: boolean;
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

export function MarketContextSection({
  chain,
  initialGeoLevel,
  fallbackPiq,
  fallbackHomeValue,
  fallbackHomeValueYoy,
  fallbackRentIndex,
  fallbackMarketHeat,
  fallbackNetMigration,
  aiText,
  aiIsStale,
  aiIsLoading,
  onRefreshAi,
  aiPayloadBase,
  aiEnabled,
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

  // Prefetch market context + AI annotation for every available geo at mount.
  // Pill toggles become instant — they just pick a cached slot. Cost: up to
  // 3 parallel data + 3 parallel AI requests per analysis; the 24h Redis
  // cache amortizes this across repeat views.
  const byGeo = useMarketContextByGeo({
    chain,
    aiPayloadBase,
    aiEnabled: aiEnabled ?? false,
  });
  const data = byGeo.dataByPill[effectivePill];
  const activeAi = byGeo.aiByPill[effectivePill];

  // Live AI props when aiPayloadBase is wired; fall back to caller-provided
  // snapshot text for saved/shared routes.
  const queryClient = useQueryClient();
  const refreshActiveAi = useCallback(() => {
    queryClient.invalidateQueries({
      queryKey: ["ai-insight", "market_context"],
    });
  }, [queryClient]);

  const liveAiText = aiPayloadBase ? activeAi.text : (aiText ?? null);
  const liveAiLoading = aiPayloadBase
    ? activeAi.isLoading
    : (aiIsLoading ?? false);
  const liveAiStale = aiPayloadBase ? activeAi.isStale : (aiIsStale ?? false);
  const liveOnRefreshAi = aiPayloadBase ? refreshActiveAi : onRefreshAi;

  // Live values when fetch resolved; snapshot fallbacks for saved/shared routes
  // (chain=null → useMarketContext disabled → data=null → use fallbacks).
  const piqScore = data?.piq_score?.value ?? fallbackPiq ?? null;
  const homeValue = data?.home_value?.value ?? fallbackHomeValue ?? null;
  const homeValueYoy =
    data?.home_value_yoy?.value ?? fallbackHomeValueYoy ?? null;
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
      onRefresh={liveOnRefreshAi}
      aiText={liveAiText}
      aiIsStale={liveAiStale}
      aiIsLoading={liveAiLoading}
      onRefreshAi={liveOnRefreshAi}
    >
      {availablePills.length > 0 && (
        <GeoPills
          pills={availablePills}
          active={effectivePill}
          onChange={setActivePill}
        />
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-6 gap-2">
        <TileLink href={url}>
          <MetricBlock
            label="PIQ Score"
            value={toNum(piqScore)}
            format="number"
            decimals={0}
            size="sm"
            variant="score"
            subLabel={piqLabel ?? pillLabel}
          />
        </TileLink>

        <TileLink href={url}>
          <MetricBlock
            label="Home Value"
            value={toNum(homeValue)}
            format="currency"
            size="sm"
            subLabel={data?.home_value?.source ?? pillLabel}
          />
        </TileLink>

        <TileLink href={url}>
          <MetricBlock
            label="Price Apprec. YoY"
            value={toNum(homeValueYoy)}
            format="percent"
            decimals={1}
            size="sm"
            variant="directional"
            subLabel={data?.home_value_yoy?.source ?? pillLabel}
          />
        </TileLink>

        <TileLink href={url}>
          <MetricBlock
            label="Rent Index"
            value={toNum(rentIndex)}
            format="currency"
            size="sm"
            subLabel={data?.rent_index?.source ?? pillLabel}
          />
        </TileLink>

        <TileLink href={url}>
          <MetricBlock
            label="Market Heat"
            value={toNum(marketHeat)}
            format="number"
            decimals={1}
            size="sm"
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
            size="sm"
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
