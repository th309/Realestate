import { describe, it, expect } from "vitest";
import { extractZip } from "../use-analyzer-state.provenance";
import { resolveMarketZip } from "../resolve-market-zip";

/**
 * Regression suite for the analyzer's market geography.
 *
 * The defect: picking a property from the address autocomplete writes Mapbox's
 * `place_name` into the address field — "…, Illinois 61761, United States" —
 * and the old end-anchored ZIP regex found nothing there. With no ZIP the
 * market-context query never ran, so the PropertyIQ Score was absent, the
 * grading table showed "Market adj +0.00", and the AI verdict was told no
 * score existed for a market that scores fine.
 */
describe("extractZip finds the ZIP wherever the address format puts it", () => {
  it("reads a trailing ZIP (RentCast resolved_address format)", () => {
    expect(extractZip("200 Orlando Ave, Normal, IL 61761")).toBe("61761");
  });

  it("reads a ZIP followed by a country (Mapbox place_name format)", () => {
    expect(
      extractZip("200 Orlando Avenue, Normal, Illinois 61761, United States"),
    ).toBe("61761");
  });

  it("reads a ZIP+4 and keeps only the 5-digit prefix", () => {
    expect(
      extractZip("200 Orlando Avenue, Normal, Illinois 61761-2231, USA"),
    ).toBe("61761");
  });

  it("does not mistake a five-digit house number for a ZIP", () => {
    expect(extractZip("12345 Main Street")).toBeNull();
  });

  it("prefers the real ZIP over a five-digit house number", () => {
    expect(
      extractZip("12345 Main St, Normal, Illinois 61761, United States"),
    ).toBe("61761");
  });

  it("returns null when the address carries no ZIP", () => {
    expect(extractZip("Normal, Illinois, United States")).toBeNull();
    expect(extractZip(undefined)).toBeNull();
  });
});

describe("resolveMarketZip picks the most trustworthy ZIP available", () => {
  it("honours an explicit ?zip= param above everything else", () => {
    expect(
      resolveMarketZip({
        paramZip: "61701",
        selectedZip: "61761",
        resolvedAddress: "200 Orlando Ave, Normal, IL 60601",
        typedAddress: "200 Orlando Avenue, Normal, Illinois 61761",
      }),
    ).toBe("61701");
  });

  it("ignores a malformed ?zip= param", () => {
    expect(
      resolveMarketZip({
        paramZip: "617",
        typedAddress: "200 Orlando Ave, Normal, IL 61761",
      }),
    ).toBe("61761");
  });

  it("uses the autocomplete suggestion's own postcode before parsing strings", () => {
    expect(
      resolveMarketZip({
        selectedZip: "61761",
        typedAddress:
          "200 Orlando Avenue, Normal, Illinois 61761, United States",
      }),
    ).toBe("61761");
  });

  it("falls back to RentCast's resolved address", () => {
    expect(
      resolveMarketZip({
        resolvedAddress: "200 Orlando Ave, Normal, IL 61761",
        typedAddress: "200 Orlando Avenue",
      }),
    ).toBe("61761");
  });

  it("still resolves a market for free-tier users, who never get RentCast", () => {
    expect(
      resolveMarketZip({
        typedAddress:
          "200 Orlando Avenue, Normal, Illinois 61761, United States",
      }),
    ).toBe("61761");
  });

  it("returns null when no source carries a ZIP", () => {
    expect(resolveMarketZip({ typedAddress: "200 Orlando Avenue" })).toBeNull();
    expect(resolveMarketZip({})).toBeNull();
  });
});
