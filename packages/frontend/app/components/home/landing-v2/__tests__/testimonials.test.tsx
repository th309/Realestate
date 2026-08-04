import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { Testimonials } from "../Testimonials";

/**
 * The quotes are approved copy. These are the verbatim strings — if a rewrite
 * ever creeps in, these tests fail rather than the change shipping silently.
 */
const MCP_QUOTE =
  "What sold me wasn't the dashboard, it was hooking PropertyIQ into Claude through MCP. I can ask for a full market breakdown, migration trends, rent-to-price ratios, economic indicators, and get back a detailed narrative instead of a pile of raw numbers I have to interpret myself. It's like having a research analyst on call.";

const QUOTES = [
  MCP_QUOTE,
  "I used to spend hours cross-referencing Zillow, Census data, and spreadsheets before making an offer. Now I pull up a market's PropertyIQ Score and know in seconds whether it fits my buy-and-hold strategy. The deal grading caught a flip I almost overpaid for. This tool paid for itself on the first deal.",
  "My clients expect data, not just gut feelings. PropertyIQ lets me generate a buyer consultation brief in minutes — market comps, price trends, neighborhood scores, all in one clean report I can hand straight to a client. It's made me look sharper in every listing presentation.",
  "The A to F deal grading is what sold me. I can run a property through the Deal Analyzer and immediately see if the numbers work for a BRRRR or a flip — cash on cash, cap rate, the whole picture. I stopped guessing and started closing deals I can actually defend to my lender.",
];

describe("Testimonials renders all four approved quotes in mockup order", () => {
  it("renders the section heading without an eyebrow or subhead", () => {
    const { getByRole } = render(<Testimonials />);
    expect(
      getByRole("heading", { name: "What investors and agents are saying" }),
    ).toBeInTheDocument();
  });

  it("renders exactly four testimonial cards", () => {
    const { container } = render(<Testimonials />);
    expect(container.querySelectorAll("figure")).toHaveLength(4);
  });

  it("orders the attributions Jordan K., Marcus T., Dana R., then Chris L.", () => {
    const { container } = render(<Testimonials />);
    const names = Array.from(container.querySelectorAll("figcaption")).map(
      (caption) => caption.textContent,
    );
    expect(names).toEqual([
      "Jordan K.Real Estate Investor & Data Nerd",
      "Marcus T.Real Estate Investor · Charlotte, NC",
      "Dana R.Broker Associate · Austin, TX",
      "Chris L.BRRRR Investor · Columbus, OH",
    ]);
  });

  it("reproduces each quote verbatim in mockup order", () => {
    const { container } = render(<Testimonials />);
    const quotes = Array.from(container.querySelectorAll("blockquote")).map(
      (quote) => quote.textContent,
    );
    expect(quotes).toEqual(QUOTES);
  });
});

describe("Testimonials marks each quote up as a real attributed quotation", () => {
  it("puts every quote inside a blockquote, not a div", () => {
    const { container } = render(<Testimonials />);
    QUOTES.forEach((quote) => {
      const owner = Array.from(container.querySelectorAll("blockquote")).find(
        (element) => element.textContent === quote,
      );
      expect(owner).toBeDefined();
    });
  });

  it("pairs every blockquote with a figcaption inside the same figure", () => {
    const { container } = render(<Testimonials />);
    Array.from(container.querySelectorAll("figure")).forEach((figure) => {
      expect(figure.querySelector("blockquote")).not.toBeNull();
      expect(figure.querySelector("figcaption")).not.toBeNull();
    });
  });

  it("avoids the q element, which injects quotation marks in some engines", () => {
    const { container } = render(<Testimonials />);
    expect(container.querySelectorAll("q")).toHaveLength(0);
  });

  /**
   * The mockup drew an initials disc where a headshot would go. A disc in a
   * photo's slot reads as an image that failed to load, so the attribution is
   * text only — and nothing decorative should reappear in the caption.
   */
  it("shows no avatar placeholder in the attribution", () => {
    const { container } = render(<Testimonials />);
    expect(
      container.querySelectorAll("figcaption [aria-hidden='true']"),
    ).toHaveLength(0);
    expect(container.textContent).not.toMatch(/\b(JK|MT|DR|CL)\b/);
  });
});

describe("Testimonials leads with the MCP quote as the only tagged card", () => {
  it("places the MCP quote first", () => {
    const { container } = render(<Testimonials />);
    expect(container.querySelector("blockquote")?.textContent).toBe(MCP_QUOTE);
  });

  it("tags only one card with 'Why they switched'", () => {
    const { getAllByText } = render(<Testimonials />);
    expect(getAllByText("Why they switched")).toHaveLength(1);
  });

  it("puts the 'Why they switched' tag on the MCP card and no other", () => {
    const { container } = render(<Testimonials />);
    const figures = Array.from(container.querySelectorAll("figure"));
    const tagged = figures.filter((figure) =>
      figure.textContent?.includes("Why they switched"),
    );
    expect(tagged).toHaveLength(1);
    expect(tagged[0]).toBe(figures[0]);
    expect(tagged[0].querySelector("blockquote")?.textContent).toBe(MCP_QUOTE);
  });
});
