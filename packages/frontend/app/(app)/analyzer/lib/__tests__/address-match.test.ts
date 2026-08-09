import { describe, it, expect } from "vitest";
import {
  normalizeAddress,
  extractAddressIdentity,
  isRealAddressMismatch,
} from "../address-match";

describe("normalizeAddress folds USPS abbreviation differences to one form", () => {
  it("collapses the exact Mapbox-vs-RentCast pair that triggered the false alarm", () => {
    expect(
      normalizeAddress("125 South Market Street, Frederick, Maryland 21701"),
    ).toBe(normalizeAddress("125 S Market St, Frederick, MD 21701"));
  });

  it("folds directionals, suffixes, and state names independently", () => {
    expect(
      normalizeAddress("400 Northwest Grand Avenue, Phoenix, Arizona 85003"),
    ).toBe("400 nw grand ave phoenix az 85003");
  });

  it("treats multi-word state names as one token", () => {
    expect(normalizeAddress("1 Main St, Albany, New York 12207")).toBe(
      "1 main st albany ny 12207",
    );
  });

  it("folds '#5' and 'Unit 5' and 'Apt 5' to the same token", () => {
    const hash = normalizeAddress("5 W South St #5, Frederick, MD 21701");
    expect(normalizeAddress("5 W South St Unit 5, Frederick, MD 21701")).toBe(
      hash,
    );
    expect(normalizeAddress("5 W South St Apt 5, Frederick, MD 21701")).toBe(
      hash,
    );
  });
});

describe("extractAddressIdentity pulls the building-identifying tokens", () => {
  it("reads the leading house number and the ZIP", () => {
    expect(
      extractAddressIdentity("125 S Market St, Frederick, MD 21701"),
    ).toMatchObject({
      streetNumber: "125",
      zip: "21701",
    });
  });

  it("keeps an alphanumeric house number intact", () => {
    expect(
      extractAddressIdentity("125A S Market St, Frederick, MD 21701")
        .streetNumber,
    ).toBe("125a");
  });

  it("compares ZIP+4 on its 5-digit base", () => {
    expect(
      extractAddressIdentity("125 S Market St, Frederick, MD 21701-1234").zip,
    ).toBe("21701");
  });

  it("returns nulls rather than guessing when tokens are absent", () => {
    expect(extractAddressIdentity("S Market St, Frederick")).toMatchObject({
      streetNumber: null,
      zip: null,
    });
  });

  it("strips the house number, unit, and trailing locality from the street core", () => {
    expect(
      extractAddressIdentity("125 S Market St, Frederick, MD 21701").streetCore,
    ).toBe("s market st");
    expect(
      extractAddressIdentity("5 W South St Apt 5, Frederick, MD 21701")
        .streetCore,
    ).toBe("w s st");
  });
});

describe("isRealAddressMismatch warns only on a substituted building", () => {
  it("stays silent on abbreviation-only differences", () => {
    expect(
      isRealAddressMismatch(
        "125 South Market Street, Frederick, Maryland 21701",
        "125 S Market St, Frederick, MD 21701",
      ),
    ).toBe(false);
  });

  it("fires when RentCast substitutes a different house number", () => {
    // The case this warning exists for: no record at 123, so RentCast answers
    // with the neighbour and every figure on the page describes 125.
    expect(
      isRealAddressMismatch(
        "123 S Market St, Frederick, MD 21701",
        "125 S Market St, Frederick, MD 21701",
      ),
    ).toBe(true);
  });

  it("fires on a ZIP substitution even when the street matches", () => {
    expect(
      isRealAddressMismatch(
        "125 S Market St, Frederick, MD 21701",
        "125 S Market St, Frederick, MD 21702",
      ),
    ).toBe(true);
  });

  it("stays silent when the user gave no house number to contradict", () => {
    expect(
      isRealAddressMismatch(
        "South Market Street, Frederick, Maryland",
        "125 S Market St, Frederick, MD 21701",
      ),
    ).toBe(false);
  });

  it("stays silent on an empty or whitespace-only input", () => {
    expect(isRealAddressMismatch("", "125 S Market St")).toBe(false);
    expect(isRealAddressMismatch("   ", "125 S Market St")).toBe(false);
  });

  it("fires when only the STREET differs — same number, same ZIP", () => {
    // Caught in review. House number 125 exists on most streets in a ZIP, so a
    // number+ZIP-only rule sat silent here while every figure on the page
    // described a different building.
    expect(
      isRealAddressMismatch(
        "125 Market St, Frederick, MD 21701",
        "125 Elm St, Frederick, MD 21701",
      ),
    ).toBe(true);
  });

  it("stays silent when a comma-less input folds the city into the street segment", () => {
    // The prefix rule: "s market st" prefixes "s market st frederick md".
    expect(
      isRealAddressMismatch(
        "125 South Market Street Frederick Maryland 21701",
        "125 S Market St, Frederick, MD 21701",
      ),
    ).toBe(false);
  });

  it("ignores a unit-designator difference on the same building", () => {
    expect(
      isRealAddressMismatch(
        "5 W South Street Apt 5, Frederick, Maryland 21701",
        "5 W South St, Unit 5, Frederick, MD 21701",
      ),
    ).toBe(false);
  });
});
