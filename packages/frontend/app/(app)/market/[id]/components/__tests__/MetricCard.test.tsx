/**
 * MetricCard loading state — task 1.2 (skeleton loading states).
 *
 * The card's title/badges are always known synchronously (metricId is a
 * static prop, not fetched), so only the value line depends on async data.
 * These tests confirm the value line renders a skeleton (not a spinner) while
 * loading, and — per the brief's dimension-parity requirement — that the
 * value container's className is IDENTICAL between the loading and loaded
 * renders. jsdom doesn't lay out real pixel dimensions (no offsetWidth), so
 * asserting identical container structure is the reliable proxy for "the
 * skeleton matches the final layout exactly."
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// MetricTitle pulls in useMetricFreshness (react-query), which needs a
// QueryClientProvider we don't otherwise need for this test — stub it to a
// plain label so this stays a focused unit test of MetricCard's own loading
// state, not MetricTitle's internals.
vi.mock("@/app/components/MetricTitle", () => ({
  MetricTitle: ({ metricId }: { metricId: string }) => <span>{metricId}</span>,
}));

import { MetricCard } from "../MetricCard";

const baseProps = {
  metricId: "home_value",
  trendPercent: null,
  trendDirection: "stable" as const,
};

describe("MetricCard loading state", () => {
  it("renders a skeleton in place of the value, not a spinner", () => {
    const { container } = render(
      <MetricCard {...baseProps} formattedValue="—" isLoading />,
    );

    expect(container.querySelector(".animate-spin")).not.toBeInTheDocument();
    expect(
      container.querySelector('[class*="animate-pulse"]'),
    ).toBeInTheDocument();
    // The loading placeholder replaces the real value text entirely.
    expect(screen.queryByText("$450,000")).not.toBeInTheDocument();
  });

  it("renders the real value (no skeleton) once loaded", () => {
    const { container } = render(
      <MetricCard {...baseProps} formattedValue="$450,000" isLoading={false} />,
    );

    expect(screen.getByText("$450,000")).toBeInTheDocument();
    expect(
      container.querySelector('[class*="animate-pulse"]'),
    ).not.toBeInTheDocument();
  });

  it("keeps the value line's container classes identical loading vs loaded (dimension parity)", () => {
    const { container: loadingContainer } = render(
      <MetricCard {...baseProps} formattedValue="—" isLoading />,
    );
    const { container: loadedContainer } = render(
      <MetricCard {...baseProps} formattedValue="$450,000" isLoading={false} />,
    );

    const loadingValueBox = loadingContainer.querySelector(
      ".text-xl.font-bold.text-on-surface",
    );
    const loadedValueBox = loadedContainer.querySelector(
      ".text-xl.font-bold.text-on-surface",
    );

    expect(loadingValueBox).not.toBeNull();
    expect(loadedValueBox).not.toBeNull();
    expect(loadingValueBox!.className).toBe(loadedValueBox!.className);
  });
});
