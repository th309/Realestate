import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";

const mockUseScoreData = vi.fn();
vi.mock("@/app/map/hooks/useScoreData", () => ({
  useScoreData: (...args: unknown[]) => mockUseScoreData(...args),
}));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: any) => (
    <a href={typeof href === "string" ? href : ""} {...rest}>
      {children}
    </a>
  ),
}));

import { ScoreGaugeWidget } from "../ScoreGaugeWidget";

describe("ScoreGaugeWidget", () => {
  it("links to the score methodology page", () => {
    mockUseScoreData.mockReturnValue({
      data: { propertyiq: { score: 72, confidence: { level: "b" } } },
      loading: false,
      error: null,
    });

    const { container } = render(
      <ScoreGaugeWidget
        geographyType="metro"
        geographyId="31080"
        scoreType="propertyiq"
      />,
    );

    expect(
      container.querySelector('a[href="/scores/methodology"]'),
    ).toBeTruthy();
  });
});
