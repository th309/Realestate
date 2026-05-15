import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { BestPlayCallout, pickBestPlay } from "../BestPlayCallout";

describe("pickBestPlay", () => {
  it("picks BRRRR when score >= 80 and post-refi cashflow > 0", () => {
    expect(
      pickBestPlay({
        buyAndHold: { irr10: 0.1, cashflowMonthly: 200 },
        flip: { roiPct: 25, projectedProfit: 50_000 },
        brrrr: { score: 85, postRefiCashflow: 300 },
      }),
    ).toBe("brrrr");
  });

  it("picks Flip when BRRRR weak but Flip strong", () => {
    expect(
      pickBestPlay({
        buyAndHold: { irr10: 0.08, cashflowMonthly: 100 },
        flip: { roiPct: 25, projectedProfit: 50_000 },
        brrrr: { score: 60, postRefiCashflow: 0 },
      }),
    ).toBe("flip");
  });

  it("falls through to Buy & Hold when neither qualifies", () => {
    expect(
      pickBestPlay({
        buyAndHold: { irr10: 0.08, cashflowMonthly: 100 },
        flip: { roiPct: 10, projectedProfit: 10_000 },
        brrrr: { score: 60, postRefiCashflow: 0 },
      }),
    ).toBe("buyAndHold");
  });
});

describe("BestPlayCallout", () => {
  it("renders winner name and tagline", () => {
    const { container } = render(
      <BestPlayCallout
        scores={{
          buyAndHold: { irr10: 0.08, cashflowMonthly: 100 },
          flip: { roiPct: 25, projectedProfit: 50_000 },
          brrrr: { score: 60, postRefiCashflow: 0 },
        }}
      />,
    );
    const el = container.querySelector("[data-best-play]");
    expect(el?.getAttribute("data-winner")).toBe("flip");
    expect(el?.textContent).toMatch(/Flip/);
    expect(el?.textContent).toMatch(/25\.0% ROI/);
    expect(el?.textContent).toMatch(/\$50K profit/);
  });
});
