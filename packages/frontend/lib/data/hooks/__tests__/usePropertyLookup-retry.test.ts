import { describe, it, expect } from "vitest";
import { shouldRetryPropertyLookup } from "../usePropertyLookup";
import { PropertyLookupHttpError } from "../../fetchers/property-lookup";

describe("shouldRetryPropertyLookup retries transient failures only", () => {
  it("retries a 5xx up to 2 times, then stops", () => {
    const err = new PropertyLookupHttpError(502);
    expect(shouldRetryPropertyLookup(0, err)).toBe(true);
    expect(shouldRetryPropertyLookup(1, err)).toBe(true);
    expect(shouldRetryPropertyLookup(2, err)).toBe(false);
  });

  it("retries network-level errors (no HTTP status)", () => {
    expect(shouldRetryPropertyLookup(0, new TypeError("Failed to fetch"))).toBe(
      true,
    );
  });

  it("never retries 4xx client errors", () => {
    expect(shouldRetryPropertyLookup(0, new PropertyLookupHttpError(400))).toBe(
      false,
    );
    expect(shouldRetryPropertyLookup(0, new PropertyLookupHttpError(403))).toBe(
      false,
    );
    expect(shouldRetryPropertyLookup(0, new PropertyLookupHttpError(404))).toBe(
      false,
    );
  });
});
