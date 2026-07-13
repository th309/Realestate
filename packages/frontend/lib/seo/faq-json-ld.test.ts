import { describe, it, expect } from "vitest";
import { buildFaqJsonLd } from "./faq-json-ld";

describe("buildFaqJsonLd", () => {
  it("wraps questions and answers in FAQPage schema shape", () => {
    const result = buildFaqJsonLd([
      {
        question: "What is PropertyIQ?",
        answer: "A real estate analytics platform.",
      },
    ]);
    expect(result["@type"]).toBe("FAQPage");
    expect(result["@context"]).toBe("https://schema.org");
    expect(result.mainEntity).toHaveLength(1);
    expect(result.mainEntity[0]).toEqual({
      "@type": "Question",
      name: "What is PropertyIQ?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "A real estate analytics platform.",
      },
    });
  });

  it("returns an empty mainEntity array for no faqs", () => {
    expect(buildFaqJsonLd([])).toEqual({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: [],
    });
  });
});
