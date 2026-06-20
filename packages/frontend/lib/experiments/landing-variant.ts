/**
 * Landing-page A/B experiment flag.
 *
 * A single env var `LANDING_EXPERIMENT` (set in Railway for prod — a runtime
 * var, NOT NEXT_PUBLIC_, so flipping it restarts the service without a rebuild)
 * drives which homepage variant a visitor sees:
 *
 *   off       -> everyone sees A (the existing homepage) — instant rollback
 *   preview   -> everyone sees A; B reachable only via ?landing=v2 override
 *   ab:<n>    -> n% of new visitors get B (sticky per visitor), rest get A
 *   on        -> everyone sees B (promote the winner)
 *
 * Variant assignment happens in middleware.ts (server-side, sticky cookie) so
 * the server component renders A or B directly — no client flash.
 */

export type LandingVariant = "A" | "B";

export type LandingMode =
  | { kind: "off" }
  | { kind: "preview" }
  | { kind: "ab"; percentB: number }
  | { kind: "on" };

export const LANDING_VARIANT_COOKIE = "piq-variant";
export const LANDING_PREVIEW_PARAM = "landing"; // ?landing=v2 forces B
export const LANDING_PREVIEW_VALUE = "v2";

/** Parse the `LANDING_EXPERIMENT` env value. Unknown/empty -> off. */
export function parseLandingMode(raw: string | undefined): LandingMode {
  if (!raw) return { kind: "off" };
  const v = raw.trim().toLowerCase();
  if (v === "off") return { kind: "off" };
  if (v === "preview") return { kind: "preview" };
  if (v === "on") return { kind: "on" };
  const m = v.match(/^ab:(\d{1,3})$/);
  if (m) {
    const n = Math.min(100, Math.max(0, parseInt(m[1], 10)));
    return { kind: "ab", percentB: n };
  }
  return { kind: "off" };
}

/**
 * Deterministic 0-99 bucket from a seed (uid / visitor cookie). FNV-1a so it is
 * stable across processes and deploys — NO Math.random / Date (would break
 * stickiness and SSR determinism).
 */
export function hashToPercent(seed: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0) % 100;
}

/**
 * Resolve the variant for a request. Preview override wins; an existing sticky
 * cookie is always honored in ab mode so a visitor never flips mid-experiment.
 */
export function resolveVariant(
  mode: LandingMode,
  opts: {
    existingCookie?: LandingVariant;
    previewOverride?: boolean;
    splitSeed: string;
  },
): LandingVariant {
  if (opts.previewOverride) return "B";
  switch (mode.kind) {
    case "off":
      return "A";
    case "on":
      return "B";
    case "preview":
      return "A";
    case "ab":
      if (opts.existingCookie) return opts.existingCookie;
      return hashToPercent(opts.splitSeed) < mode.percentB ? "B" : "A";
  }
}
