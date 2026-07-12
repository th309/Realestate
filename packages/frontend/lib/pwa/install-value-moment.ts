/**
 * Value-moment gating for the install banner: rather than pester every
 * visitor immediately, we wait until they've hit a "value moment" (analyzer
 * grade, report view) at least twice before offering the install banner.
 */
import { isStandaloneDisplayMode } from "./is-standalone";

const VALUE_MOMENT_STORAGE_KEY = "piq-install-value-moments";
const DISMISSED_STORAGE_KEY = "piq-install-banner-dismissed";
const ELIGIBILITY_THRESHOLD = 2;

/** Increments the value-moment counter. Call this at each value moment. */
export function recordInstallValueMoment(): void {
  if (typeof window === "undefined") return;
  const count = Number(
    window.localStorage.getItem(VALUE_MOMENT_STORAGE_KEY) ?? "0",
  );
  window.localStorage.setItem(VALUE_MOMENT_STORAGE_KEY, String(count + 1));
}

/** Marks the install banner dismissed so it never reappears for this visitor. */
export function dismissInstallBanner(): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(DISMISSED_STORAGE_KEY, "1");
}

/**
 * The install banner may show once the visitor has hit >=2 value moments,
 * hasn't already installed the app (standalone display mode), and hasn't
 * dismissed the banner before.
 */
export function isInstallBannerEligible(): boolean {
  if (typeof window === "undefined") return false;
  if (isStandaloneDisplayMode()) return false;
  if (window.localStorage.getItem(DISMISSED_STORAGE_KEY)) return false;
  const count = Number(
    window.localStorage.getItem(VALUE_MOMENT_STORAGE_KEY) ?? "0",
  );
  return count >= ELIGIBILITY_THRESHOLD;
}
