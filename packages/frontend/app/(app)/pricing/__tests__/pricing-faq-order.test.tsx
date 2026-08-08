/**
 * The pricing FAQ renders LAST.
 *
 * pricing/layout.tsx used to emit <FaqSection> before {children}, which put a
 * five-question accordion above the plan cards — the one thing the page exists
 * to show. Every other page on the site renders its FAQ after the content.
 */
import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";

vi.mock("@/app/components/seo/FaqSection", () => ({
  FaqSection: () => <section data-testid="faq-section" />,
}));

import PricingLayout from "../layout";
import { PRICING_FAQS } from "../pricing-faqs";

describe("Pricing layout ordering", () => {
  it("renders the FAQ after the page content", () => {
    const { container } = render(
      <PricingLayout>
        <main data-testid="pricing-content" />
      </PricingLayout>,
    );

    const nodes = Array.from(
      container.querySelectorAll(
        '[data-testid="pricing-content"], [data-testid="faq-section"]',
      ),
    );

    expect(nodes.map((n) => n.getAttribute("data-testid"))).toEqual([
      "pricing-content",
      "faq-section",
    ]);
  });

  it("still ships the FAQ content", () => {
    expect(PRICING_FAQS.length).toBeGreaterThan(0);
  });
});
