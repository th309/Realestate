/**
 * Detects whether the app is running as an installed app (standalone display
 * mode) rather than in a browser tab. Gates install UI (never show when
 * installed) and standalone-specific UX (code-first auth flows, back handling).
 *
 * iOS Safari exposes the non-standard `navigator.standalone`; every Chromium
 * browser (and modern iOS for manifest-installed apps) reports the
 * `display-mode: standalone` media query.
 */
export function isStandaloneDisplayMode(): boolean {
  if (typeof window === "undefined") return false;
  const iosStandalone =
    (window.navigator as Navigator & { standalone?: boolean }).standalone ===
    true;
  const displayModeStandalone =
    window.matchMedia?.("(display-mode: standalone)")?.matches === true;
  return iosStandalone || displayModeStandalone;
}
