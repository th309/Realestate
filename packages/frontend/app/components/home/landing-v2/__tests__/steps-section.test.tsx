import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { StepsSection } from "../StepsSection";

describe("StepsSection renders the three approved steps in mockup order", () => {
  it("shows every step heading in the pick-read-act sequence", () => {
    const { container } = render(<StepsSection />);
    const headings = Array.from(container.querySelectorAll("h3")).map(
      (heading) => heading.textContent,
    );
    expect(headings).toEqual([
      "Pick a market",
      "Read the score",
      "Act before the crowd",
    ]);
  });

  it("renders the approved section heading and kicker", () => {
    const { getByText, container } = render(<StepsSection />);
    expect(getByText("How it works")).toBeInTheDocument();
    expect(container.querySelector("h2")?.textContent).toBe(
      "Three steps to a defensible market call",
    );
  });
});

describe("StepsSection uses the approved body copy verbatim", () => {
  it.each([
    "Search any metro, county, or ZIP — or start from the map and let the color tell you where to look.",
    "One number, four inputs, a confidence grade, and the state benchmark it's measured against.",
    "Export a branded report, set an alert, or query it straight from Claude over MCP.",
  ])("renders the copy %#", (copy) => {
    const { getByText } = render(<StepsSection />);
    expect(getByText(copy)).toBeInTheDocument();
  });
});

/**
 * The connector arrows repeat information the card order already carries, so a
 * screen reader announcing them would only add noise between the steps.
 */
describe("StepsSection hides the connector arrows from assistive technology", () => {
  it("marks each of the two connectors aria-hidden", () => {
    const { container } = render(<StepsSection />);
    const connectors = container.querySelectorAll('div[aria-hidden="true"]');
    expect(connectors).toHaveLength(2);
  });

  it("drops the connectors from the stacked mobile layout", () => {
    const { container } = render(<StepsSection />);
    const connectors = Array.from(
      container.querySelectorAll('div[aria-hidden="true"]'),
    );
    for (const connector of connectors) {
      expect(connector.className).toContain("hidden");
      expect(connector.className).toContain("lg:flex");
    }
  });
});
