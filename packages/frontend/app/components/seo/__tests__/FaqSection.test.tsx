import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { FaqSection } from "../FaqSection";

const THREE_FAQS = [
  { question: "Q1?", answer: "A1." },
  { question: "Q2?", answer: "A2." },
  { question: "Q3?", answer: "A3." },
];

describe("FaqSection", () => {
  it("renders nothing when fewer than 3 faqs are given", () => {
    const { container } = render(<FaqSection faqs={THREE_FAQS.slice(0, 2)} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders each question and answer plus a valid FAQPage JSON-LD script", () => {
    render(<FaqSection faqs={THREE_FAQS} />);
    expect(screen.getByText("Q1?")).toBeInTheDocument();
    expect(screen.getByText("A3.")).toBeInTheDocument();

    const script = document.querySelector('script[type="application/ld+json"]');
    expect(script).not.toBeNull();
    const parsed = JSON.parse(script!.innerHTML);
    expect(parsed["@type"]).toBe("FAQPage");
    expect(parsed.mainEntity).toHaveLength(3);
  });

  it("uses a custom heading when provided", () => {
    render(<FaqSection faqs={THREE_FAQS} heading="Questions, answered" />);
    expect(
      screen.getByRole("heading", { name: "Questions, answered" }),
    ).toBeInTheDocument();
  });
});
