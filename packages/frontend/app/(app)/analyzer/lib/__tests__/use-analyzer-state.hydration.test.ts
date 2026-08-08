import { describe, it, expect, vi } from "vitest";
import { shouldAutoFetchProperty } from "../use-analyzer-state";

describe("shouldAutoFetchProperty gates the RentCast lookup on open", () => {
  const base = {
    isPro: true,
    address: "123 Main St, Austin TX",
    paramAddress: "123 Main St, Austin TX",
    alreadyFetched: false,
    isHydrated: false,
  };

  it("fetches for a Pro user deep-linked with ?address=", () => {
    expect(shouldAutoFetchProperty(base)).toBe(true);
  });

  it("does NOT fetch when hydrating a saved deal — RentCast is paid and quota-limited", () => {
    expect(shouldAutoFetchProperty({ ...base, isHydrated: true })).toBe(false);
  });

  it("does not fetch twice", () => {
    expect(shouldAutoFetchProperty({ ...base, alreadyFetched: true })).toBe(
      false,
    );
  });

  it("does not fetch for a free user", () => {
    expect(shouldAutoFetchProperty({ ...base, isPro: false })).toBe(false);
  });

  it("does not fetch without an ?address= param", () => {
    expect(shouldAutoFetchProperty({ ...base, paramAddress: undefined })).toBe(
      false,
    );
  });

  it("does not fetch on a too-short address", () => {
    expect(shouldAutoFetchProperty({ ...base, address: "abc" })).toBe(false);
  });
});
