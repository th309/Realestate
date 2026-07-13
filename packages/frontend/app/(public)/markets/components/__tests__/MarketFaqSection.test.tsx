import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MarketFaqSection } from "../MarketFaqSection";

const FIVE_FAQS = Array.from({ length: 5 }, (_, i) => ({
  question: `Question ${i}?`,
  answer: `Answer ${i}.`,
}));

describe("MarketFaqSection", () => {
  it("returns null below 3 faqs (data-gating preserved)", () => {
    const { container } = render(
      <MarketFaqSection faqs={FIVE_FAQS.slice(0, 2)} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renders faqs and FAQPage JSON-LD via the shared FaqSection", () => {
    const { container } = render(<MarketFaqSection faqs={FIVE_FAQS} />);
    expect(screen.getByText("Question 0?")).toBeInTheDocument();
    const script = container.querySelector(
      'script[type="application/ld+json"]',
    );
    const parsed = JSON.parse(script!.innerHTML);
    expect(parsed["@type"]).toBe("FAQPage");
    expect(parsed.mainEntity).toHaveLength(5);
  });
});
