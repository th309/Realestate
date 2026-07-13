import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ScoresFaqSection } from "../ScoresFaqSection";

describe("ScoresFaqSection", () => {
  it("renders all 8 questions with a valid FAQPage JSON-LD script", () => {
    render(<ScoresFaqSection />);
    expect(
      screen.getByText("What is a real estate market score?"),
    ).toBeInTheDocument();
    const script = document.querySelector('script[type="application/ld+json"]');
    const parsed = JSON.parse(script!.innerHTML);
    expect(parsed["@type"]).toBe("FAQPage");
    expect(parsed.mainEntity).toHaveLength(8);
    expect(parsed.mainEntity[0].name).toBe(
      "What is a real estate market score?",
    );
  });
});
