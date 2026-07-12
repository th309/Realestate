import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  recordInstallValueMoment,
  isInstallBannerEligible,
  dismissInstallBanner,
  INSTALL_VALUE_MOMENT_EVENT,
} from "../install-value-moment";

const VALUE_MOMENT_KEY = "piq-install-value-moments";
const DISMISSED_KEY = "piq-install-banner-dismissed";

function setStandalone(matches: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: query === "(display-mode: standalone)" ? matches : false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia;
}

describe("install-value-moment", () => {
  beforeEach(() => {
    localStorage.clear();
    setStandalone(false);
  });

  afterEach(() => {
    setStandalone(false);
  });

  describe("recordInstallValueMoment", () => {
    it("starts a fresh counter at 1", () => {
      recordInstallValueMoment();
      expect(localStorage.getItem(VALUE_MOMENT_KEY)).toBe("1");
    });

    it("increments an existing counter", () => {
      recordInstallValueMoment();
      recordInstallValueMoment();
      recordInstallValueMoment();
      expect(localStorage.getItem(VALUE_MOMENT_KEY)).toBe("3");
    });

    it("dispatches INSTALL_VALUE_MOMENT_EVENT on window so same-tab listeners (e.g. InstallBanner) can react without a reload", () => {
      const handler = vi.fn();
      window.addEventListener(INSTALL_VALUE_MOMENT_EVENT, handler);
      try {
        recordInstallValueMoment();
        expect(handler).toHaveBeenCalledTimes(1);
      } finally {
        window.removeEventListener(INSTALL_VALUE_MOMENT_EVENT, handler);
      }
    });
  });

  describe("isInstallBannerEligible", () => {
    it("is false with zero value moments", () => {
      expect(isInstallBannerEligible()).toBe(false);
    });

    it("is false below the threshold (1 moment)", () => {
      recordInstallValueMoment();
      expect(isInstallBannerEligible()).toBe(false);
    });

    it("is true at the threshold (2 moments)", () => {
      recordInstallValueMoment();
      recordInstallValueMoment();
      expect(isInstallBannerEligible()).toBe(true);
    });

    it("stays true above the threshold", () => {
      recordInstallValueMoment();
      recordInstallValueMoment();
      recordInstallValueMoment();
      expect(isInstallBannerEligible()).toBe(true);
    });

    it("is false once dismissed, even above the threshold", () => {
      recordInstallValueMoment();
      recordInstallValueMoment();
      dismissInstallBanner();
      expect(isInstallBannerEligible()).toBe(false);
    });

    it("is false when already running standalone (installed)", () => {
      recordInstallValueMoment();
      recordInstallValueMoment();
      setStandalone(true);
      expect(isInstallBannerEligible()).toBe(false);
    });
  });

  describe("dismissInstallBanner", () => {
    it("sets the dismissal flag in localStorage", () => {
      dismissInstallBanner();
      expect(localStorage.getItem(DISMISSED_KEY)).toBeTruthy();
    });
  });
});
