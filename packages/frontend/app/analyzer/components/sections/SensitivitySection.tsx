"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  DealInput,
  RentalResult,
  FlipResult,
  BrrrrResult,
} from "@propertyiq/analyzer-core";
import { piq } from "../primitives/piqTokens";
import { SectionWrapper } from "./SectionWrapper";
import { DirectionalBars } from "../primitives/DirectionalBars";
import type { BarItem } from "../primitives/DirectionalBars";
import { MetricBlock } from "../primitives/MetricBlock";
import { MetricsExpander } from "../MetricsExpander";
import { ConfidenceIndicator } from "./ConfidenceIndicator";
import type { Strategy } from "../../lib/strategy-tile-mappers";
import {
  STRATEGY_METRICS,
  computeConfidence,
  computeElasticityMetrics,
  computeImpacts,
  type MetricKey,
} from "../../lib/sensitivity-impacts";

interface CompForConfidence {
  distance?: number;
}

interface SensitivitySectionProps {
  input: DealInput;
  rental: RentalResult;
  flip: FlipResult | null;
  brrrr: BrrrrResult | null;
  arv: number;
  rehabBudget?: number;
  activeStrategy: Strategy;
  salesComps: CompForConfidence[];
  aiText?: string | null;
  aiIsStale?: boolean;
  aiIsLoading?: boolean;
  onRefreshAi?: () => void;
}

export function SensitivitySection({
  input,
  rental,
  flip,
  brrrr,
  arv,
  rehabBudget,
  activeStrategy,
  salesComps,
  aiText,
  aiIsStale,
  aiIsLoading,
  onRefreshAi,
}: SensitivitySectionProps) {
  const metrics = STRATEGY_METRICS[activeStrategy];
  const [selectedKey, setSelectedKey] = useState<MetricKey>(metrics[0].key);

  // Reset to the first metric if strategy changes and current key isn't valid.
  useEffect(() => {
    if (!metrics.some((m) => m.key === selectedKey)) {
      setSelectedKey(metrics[0].key);
    }
  }, [metrics, selectedKey]);

  const selectedMetric =
    metrics.find((m) => m.key === selectedKey) ?? metrics[0];

  const impacts = useMemo(
    () =>
      computeImpacts({
        input,
        rental,
        flip,
        brrrr,
        arv,
        rehabBudget,
        strategy: activeStrategy,
        metric: selectedMetric.key,
      }),
    [
      input,
      rental,
      flip,
      brrrr,
      arv,
      rehabBudget,
      activeStrategy,
      selectedMetric.key,
    ],
  );

  const topImpact = impacts[0];
  const hasImpact = !!topImpact && topImpact.magnitude > 0;

  const confidence = useMemo(() => computeConfidence(salesComps), [salesComps]);
  const elasticityMetrics = useMemo(
    () => computeElasticityMetrics(impacts, selectedMetric.format),
    [impacts, selectedMetric.format],
  );

  // Drop rows where the underlying input is missing (magnitude = 0). They
  // render as "$0 / $0" bars which read as "no sensitivity" when they
  // actually mean "no data entered" — informationless clutter either way.
  const data: BarItem[] = impacts
    .filter((i) => i.magnitude > 0)
    .map((i) => ({
      label: i.label,
      value: i.magnitude,
      tooltip: `${i.unit} → ${selectedMetric.label}`,
    }));

  return (
    <SectionWrapper
      id="sensitivity"
      title="Sensitivity & Confidence"
      onRefresh={onRefreshAi}
      aiText={aiText}
      aiIsStale={aiIsStale}
      aiIsLoading={aiIsLoading}
      onRefreshAi={onRefreshAi}
    >
      {/* Metric chip selector */}
      <div className="flex flex-wrap items-center gap-2">
        <span
          style={{
            fontSize: "11px",
            color: piq.textMuted,
            fontWeight: 600,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            marginRight: 4,
          }}
        >
          Sensitivity for:
        </span>
        {metrics.map((m) => {
          const isActive = m.key === selectedKey;
          return (
            <button
              key={m.key}
              type="button"
              onClick={() => setSelectedKey(m.key)}
              aria-pressed={isActive}
              className="inline-flex items-center rounded-full transition-colors"
              style={{
                padding: "5px 12px",
                fontSize: "12px",
                fontWeight: 500,
                background: isActive ? piq.indigo : "transparent",
                color: isActive ? "#FFFFFF" : piq.textPrimary,
                border: `0.5px solid ${isActive ? piq.indigo : piq.border}`,
                cursor: "pointer",
              }}
            >
              {m.label}
            </button>
          );
        })}
      </div>

      {/* Headline + confidence */}
      <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-6 items-end">
        {hasImpact && topImpact ? (
          <MetricBlock
            label={`Largest swing in ${selectedMetric.label.toLowerCase()} — ${topImpact.label}`}
            value={topImpact.magnitude}
            format={selectedMetric.format}
            size="lg"
            variant="neutral"
            subLabel={`${topImpact.unit} move`}
          />
        ) : (
          <div
            style={{
              fontSize: "13px",
              color: piq.textMuted,
              fontWeight: 500,
            }}
          >
            Enter property data to see sensitivity.
          </div>
        )}
        <ConfidenceIndicator
          tier={confidence.tier}
          description={confidence.description}
        />
      </div>

      {/* Tornado or empty-state */}
      {hasImpact ? (
        <DirectionalBars
          data={data}
          layout="tornado"
          format={selectedMetric.format}
          height={280}
        />
      ) : (
        <div
          className="text-center py-12 rounded-xl"
          style={{
            color: piq.textMuted,
            fontSize: "13px",
            background: piq.canvas,
            border: `0.5px dashed ${piq.border}`,
          }}
        >
          Load a property (or enter price + rent + financing) and the tornado
          will rank which variables move {selectedMetric.label.toLowerCase()}{" "}
          the most.
        </div>
      )}

      <MetricsExpander
        metrics={elasticityMetrics}
        label="Elasticity by variable"
      />
    </SectionWrapper>
  );
}
