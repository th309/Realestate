import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  hasOptedOutOfTracking,
  resetPrivacySignalCacheForTests,
} from "../privacy-signals";

/**
 * The Privacy Policy names Global Privacy Control and Do Not Track as the
 * self-service way to limit first-party analytics and session recording. These
 * tests are what make that published statement true rather than aspirational.
 */
describe("hasOptedOutOfTracking", () => {
  const setSignals = (opts: {
    gpc?: boolean | undefined;
    dnt?: string | null;
  }) => {
    Object.defineProperty(navigator, "globalPrivacyControl", {
      value: opts.gpc,
      configurable: true,
    });
    Object.defineProperty(navigator, "doNotTrack", {
      value: opts.dnt ?? null,
      configurable: true,
    });
  };

  beforeEach(() => {
    resetPrivacySignalCacheForTests();
    setSignals({ gpc: undefined, dnt: null });
  });

  afterEach(() => resetPrivacySignalCacheForTests());

  it("opts out when Global Privacy Control is true", () => {
    setSignals({ gpc: true });
    expect(hasOptedOutOfTracking()).toBe(true);
  });

  it("opts out when Do Not Track is exactly '1'", () => {
    setSignals({ dnt: "1" });
    expect(hasOptedOutOfTracking()).toBe(true);
  });

  it("does not opt out when neither signal is expressed", () => {
    expect(hasOptedOutOfTracking()).toBe(false);
  });

  it("does not opt out on doNotTrack 'unspecified'", () => {
    // Chrome and Firefox report "unspecified" when the user has said nothing.
    // Treating any non-null value as opt-out would disable analytics for
    // essentially every visitor.
    setSignals({ dnt: "unspecified" });
    expect(hasOptedOutOfTracking()).toBe(false);
  });

  it("does not opt out on doNotTrack '0'", () => {
    setSignals({ dnt: "0" });
    expect(hasOptedOutOfTracking()).toBe(false);
  });

  it("does not opt out when globalPrivacyControl is explicitly false", () => {
    setSignals({ gpc: false });
    expect(hasOptedOutOfTracking()).toBe(false);
  });

  it("caches the verdict so the tracker can call it per event", () => {
    setSignals({ gpc: true });
    expect(hasOptedOutOfTracking()).toBe(true);
    // Signal flipped after the first read; the cached verdict must persist,
    // because a document's signals do not change mid-session.
    setSignals({ gpc: false, dnt: null });
    expect(hasOptedOutOfTracking()).toBe(true);
  });
});
