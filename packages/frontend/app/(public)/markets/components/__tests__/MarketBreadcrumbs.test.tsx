import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { MarketBreadcrumbs } from "../MarketBreadcrumbs";
import type { AncestorChain } from "@/lib/data/market-hierarchy";

const stateEntry = { abbrev: "TX", slug: "texas", name: "Texas" };
const metroEntry = {
  cbsaCode: "12345",
  slug: "test-metro-tx",
  name: "Test Metro, TX",
  shortName: "Test Metro, TX",
  state: "TX",
};
const countyEntry = {
  fips: "48001",
  slug: "test-county-tx",
  name: "Test County",
  shortName: "Test County, TX",
  state: "TX",
  cbsaCode: "12345",
  isCity: false,
};

describe("MarketBreadcrumbs", () => {
  it("renders Home / Markets / State for a metro page (no self-referential metro crumb)", () => {
    const chain: AncestorChain = {
      state: stateEntry,
      metro: null,
      county: null,
    };
    const { container, getByText } = render(
      <MarketBreadcrumbs
        chain={chain}
        currentName="Test Metro, TX"
        currentHref="/markets/test-metro-tx"
      />,
    );
    const links = container.querySelectorAll("nav a");
    expect(Array.from(links).map((a) => a.textContent)).toEqual([
      "Home",
      "Markets",
      "Texas",
    ]);
    expect(getByText("Test Metro, TX")).toBeTruthy();
  });

  it("renders the full chain (state, metro, county) for a ZIP page", () => {
    const chain: AncestorChain = {
      state: stateEntry,
      metro: metroEntry,
      county: countyEntry,
    };
    const { container } = render(
      <MarketBreadcrumbs
        chain={chain}
        currentName="78701, Austin, TX"
        currentHref="/markets/zip/78701-austin-tx"
      />,
    );
    const links = container.querySelectorAll("nav a");
    expect(Array.from(links).map((a) => a.textContent)).toEqual([
      "Home",
      "Markets",
      "Texas",
      "Test Metro, TX",
      "Test County, TX",
    ]);
  });

  it("emits a matching BreadcrumbList JSON-LD script", () => {
    const chain: AncestorChain = {
      state: stateEntry,
      metro: null,
      county: null,
    };
    const { container } = render(
      <MarketBreadcrumbs
        chain={chain}
        currentName="Test Metro, TX"
        currentHref="/markets/test-metro-tx"
      />,
    );
    const script = container.querySelector(
      'script[type="application/ld+json"]',
    );
    expect(script).toBeTruthy();
    const jsonLd = JSON.parse(script!.innerHTML);
    expect(jsonLd["@type"]).toBe("BreadcrumbList");
    expect(jsonLd.itemListElement).toHaveLength(4);
    expect(jsonLd.itemListElement[3]).toMatchObject({
      position: 4,
      name: "Test Metro, TX",
      item: "https://www.propertyiq.app/markets/test-metro-tx",
    });
  });
});
