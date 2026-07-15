import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

// Stub the self-fetching gauge (it calls useScoreData → network).
vi.mock("@/app/components/scoring/ScoreGaugeWidget", () => ({
  ScoreGaugeWidget: () => <div data-testid="score-gauge" />,
}));
// MetricTitle reads metric config; render its id plainly for the test.
vi.mock("@/app/components/MetricTitle", () => ({
  MetricTitle: ({ metricId }: { metricId: string }) => <span>{metricId}</span>,
}));
// InheritedBadge/BenchmarkBadge are presentational leaves; render markers so
// tests can assert they received the right data without their own DOM/tooltip.
vi.mock("@/app/components/scoring/InheritedBadge", () => ({
  InheritedBadge: ({ sourceType }: { sourceType: string }) => (
    <span data-testid="inherited-badge">{sourceType}</span>
  ),
}));
vi.mock("@/components/benchmarks", () => ({
  BenchmarkBadge: ({
    diff,
    direction,
    parentGeoName,
  }: {
    diff: number;
    direction: string;
    parentGeoName: string;
  }) => (
    <span data-testid="benchmark-badge">
      {direction} {diff} {parentGeoName}
    </span>
  ),
}));
// MetricAlertBell is entitlement-gated and self-fetching; stub it so this
// test doesn't depend on an entitlements provider.
vi.mock("@/components/alerts", () => ({
  MetricAlertBell: ({ metricId }: { metricId: string }) => (
    <button type="button" data-testid={`alert-bell-${metricId}`}>
      bell
    </button>
  ),
}));
const getBenchmarkForMetric = vi.fn(
  () =>
    null as null | {
      metricId: string;
      value: number | null;
      parentGeo: { level: string; id: string; name: string } | null;
      parentValue: number | null;
      diff: number | null;
      direction: "better" | "worse" | "similar" | null;
    },
);
vi.mock("@/lib/benchmarks/hooks", () => ({
  getBenchmarkForMetric: (...args: unknown[]) =>
    (getBenchmarkForMetric as (...a: unknown[]) => unknown)(...args),
}));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: any) => (
    <a href={typeof href === "string" ? href : ""} {...rest}>
      {children}
    </a>
  ),
}));

import { getMetricTitle } from "@/lib/data";
import { MetricRail } from "../MetricRail";

const card = (
  formattedValue: string,
  value: number,
  overrides: Partial<{
    isInherited: boolean;
    isFallback: boolean;
    sourceGeoLevel: "metro" | "county" | "state" | "national";
  }> = {},
) => ({
  value,
  formattedValue,
  percentChange: 2.0,
  direction: "up" as const,
  isLoading: false,
  date: "2026-05-31",
  source: "zillow",
  sourceGeoId: "12420",
  sourceGeoLevel: "metro" as const,
  isInherited: false,
  isFallback: false,
  ...overrides,
});

const cards = {
  home_value: card("$455K", 455000),
  rent_index: card("$1,850", 1850),
};

const baseProps = {
  geoType: "metro",
  geoId: "12420",
  geoName: "Austin, TX",
};

describe("MetricRail", () => {
  it("renders the score gauge and a row per metric", () => {
    render(
      <MetricRail
        {...baseProps}
        cards={cards}
        metricIds={["home_value", "rent_index"]}
        selectedMetricId="home_value"
        onSelectMetric={() => {}}
      />,
    );
    expect(screen.getByTestId("score-gauge")).toBeTruthy();
    expect(screen.getByText("$455K")).toBeTruthy();
    expect(screen.getByText("$1,850")).toBeTruthy();
  });

  it("exposes the tour target on the score gauge wrapper", () => {
    const { container } = render(
      <MetricRail
        {...baseProps}
        cards={cards}
        metricIds={["home_value"]}
        selectedMetricId="home_value"
        onSelectMetric={() => {}}
      />,
    );
    expect(
      container.querySelector('[data-tour="propertyiq-score"]'),
    ).toBeTruthy();
  });

  it("calls onSelectMetric with the clicked metric id", () => {
    const onSelect = vi.fn();
    render(
      <MetricRail
        {...baseProps}
        cards={cards}
        metricIds={["home_value", "rent_index"]}
        selectedMetricId="home_value"
        onSelectMetric={onSelect}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: `Chart ${getMetricTitle("rent_index")}`,
      }),
    );
    expect(onSelect).toHaveBeenCalledWith("rent_index");
  });

  it("marks the selected row as pressed", () => {
    render(
      <MetricRail
        {...baseProps}
        cards={cards}
        metricIds={["home_value", "rent_index"]}
        selectedMetricId="home_value"
        onSelectMetric={() => {}}
      />,
    );
    const selected = screen.getByRole("button", {
      name: `Chart ${getMetricTitle("home_value")}`,
    });
    expect(selected.getAttribute("aria-pressed")).toBe("true");
  });

  it("keeps the info-icon and inherited badge independently clickable, not nested inside the selectable button", () => {
    const inheritedCards = {
      home_value: card("$455K", 455000, {
        isInherited: true,
        sourceGeoLevel: "county",
      }),
    };
    render(
      <MetricRail
        {...baseProps}
        cards={inheritedCards}
        metricIds={["home_value"]}
        selectedMetricId="home_value"
        onSelectMetric={() => {}}
      />,
    );
    const selectableButton = screen.getByRole("button", {
      name: `Chart ${getMetricTitle("home_value")}`,
    });
    // MetricTitle and InheritedBadge must be siblings of the selectable
    // button, never descendants — a <button> cannot legally contain other
    // interactive content (buttons, focusable elements).
    expect(
      selectableButton.contains(screen.getByTestId("inherited-badge")),
    ).toBe(false);
    expect(selectableButton.children.length).toBe(0);
  });

  it("links each row to its metric detail page, independent of the selectable button", () => {
    render(
      <MetricRail
        {...baseProps}
        cards={cards}
        metricIds={["home_value", "rent_index"]}
        selectedMetricId="home_value"
        onSelectMetric={() => {}}
      />,
    );
    const detailLink = screen.getByLabelText(
      `View ${getMetricTitle("home_value")} details`,
    );
    expect(detailLink.getAttribute("href")).toBe("/metrics/home_value");
    const selectableButton = screen.getByRole("button", {
      name: `Chart ${getMetricTitle("home_value")}`,
    });
    expect(selectableButton.contains(detailLink)).toBe(false);
  });

  it("renders an alert bell per metric row, independent of the selectable button", () => {
    render(
      <MetricRail
        {...baseProps}
        cards={cards}
        metricIds={["home_value", "rent_index"]}
        selectedMetricId="home_value"
        onSelectMetric={() => {}}
      />,
    );
    expect(screen.getByTestId("alert-bell-home_value")).toBeTruthy();
    expect(screen.getByTestId("alert-bell-rent_index")).toBeTruthy();
  });

  it("shows a fallback chip when the card resolved from a fallback source", () => {
    const fallbackCards = {
      home_value: card("$455K", 455000, { isFallback: true }),
    };
    render(
      <MetricRail
        {...baseProps}
        cards={fallbackCards}
        metricIds={["home_value"]}
        selectedMetricId="home_value"
        onSelectMetric={() => {}}
      />,
    );
    expect(screen.getByText("Fallback")).toBeTruthy();
  });

  it("shows an inherited badge when the card value is inherited from a parent geography", () => {
    const inheritedCards = {
      home_value: card("$455K", 455000, {
        isInherited: true,
        sourceGeoLevel: "county",
      }),
    };
    render(
      <MetricRail
        {...baseProps}
        cards={inheritedCards}
        metricIds={["home_value"]}
        selectedMetricId="home_value"
        onSelectMetric={() => {}}
      />,
    );
    expect(screen.getByTestId("inherited-badge").textContent).toBe("county");
  });

  it("shows a benchmark badge when the caller has benchmark access and a result exists", () => {
    getBenchmarkForMetric.mockReturnValueOnce({
      metricId: "home_value",
      value: 455000,
      parentGeo: { level: "state", id: "TX", name: "Texas" },
      parentValue: 400000,
      diff: 13.75,
      direction: "better",
    });
    render(
      <MetricRail
        {...baseProps}
        cards={cards}
        metricIds={["home_value"]}
        selectedMetricId="home_value"
        onSelectMetric={() => {}}
        benchmarks={[]}
        hasBenchmarkAccess
      />,
    );
    expect(screen.getByTestId("benchmark-badge")).toBeTruthy();
  });

  it("does not look up benchmarks when the caller lacks benchmark access", () => {
    getBenchmarkForMetric.mockClear();
    render(
      <MetricRail
        {...baseProps}
        cards={cards}
        metricIds={["home_value"]}
        selectedMetricId="home_value"
        onSelectMetric={() => {}}
      />,
    );
    expect(getBenchmarkForMetric).not.toHaveBeenCalled();
  });
});
