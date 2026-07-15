import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";

vi.mock("framer-motion", () => ({
  motion: new Proxy({}, { get: () => (props: any) => <div {...props} /> }),
}));
vi.mock("@/app/components/MetricTitle", () => ({
  MetricTitle: () => <span>metric-title</span>,
}));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: any) => (
    <a href={typeof href === "string" ? href : ""} {...rest}>
      {children}
    </a>
  ),
}));

import { MetricCard } from "../MetricCard";

describe("MetricCard", () => {
  it("wraps the card in a link to /metrics/<metricId>", () => {
    const { container } = render(
      <MetricCard
        metricId="home_value"
        formattedValue="$499K"
        trendPercent={null}
        trendDirection="stable"
      />,
    );
    expect(
      container.querySelector('a[href="/metrics/home_value"]'),
    ).toBeTruthy();
  });
});
