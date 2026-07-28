/**
 * Which steps a format walks an operator through, and in what order.
 *
 * Previously this lived as a hardcoded step union plus `if (format === …)`
 * branching inside page.tsx, so adding a template meant editing the wizard
 * by hand. The order now comes from the format manifest — the same
 * declaration the renderer and the create-run contract read — so a new
 * template appears in the wizard by declaring itself.
 *
 * Pure functions, no React: the sequencing is the part worth testing, and
 * it is testable without mounting anything.
 */
import {
  FORMAT_MANIFEST,
  type WizardStepType,
} from "@propertyiq/video-template/formats";

/** The step the flow always opens on; it is not format-specific. */
export const FORMAT_PICKER_STEP = "format" as const;

export type WizardStepId = typeof FORMAT_PICKER_STEP | WizardStepType;

/**
 * Step types the manifest declares but the wizard cannot render yet.
 *
 * Listed explicitly rather than silently dropped, so the gap is visible and
 * a test can pin it. `preview` exists for ranking formats (the resolved-data
 * check) but not for the rest — the live <Player> preview that fills it in
 * is a separate milestone. Remove an entry here the moment its renderer
 * lands.
 */
export const UNIMPLEMENTED_STEPS: readonly WizardStepType[] = ["preview"];

/**
 * Formats the video manifest doesn't describe.
 *
 * `infographic` is a still-graphic format that never goes through the
 * Remotion renderer, so it has no manifest entry; its flow is declared here
 * instead of being special-cased inside the runner.
 */
const NON_VIDEO_FORMAT_STEPS: Record<string, WizardStepType[]> = {
  infographic: ["params", "confirm"],
};

/** Ranking formats DO have a working preview — the resolved-rankings check. */
const RANKING_FORMATS = new Set(["top_10_ranking", "bottom_10_ranking"]);

export function stepsForFormat(format: string): WizardStepType[] {
  const declared =
    NON_VIDEO_FORMAT_STEPS[format] ??
    FORMAT_MANIFEST[format as keyof typeof FORMAT_MANIFEST]?.steps.map(
      (s) => s.type,
    );

  // An unknown format still needs a usable flow rather than a blank screen.
  if (!declared) return ["market", "confirm"];

  return declared.filter(
    (type) =>
      !UNIMPLEMENTED_STEPS.includes(type) ||
      (type === "preview" && RANKING_FORMATS.has(format)),
  );
}

export function firstStep(format: string): WizardStepId {
  return stepsForFormat(format)[0] ?? "confirm";
}

/** The step after `current`, or null when `current` is the last one. */
export function nextStep(
  format: string,
  current: WizardStepId,
): WizardStepId | null {
  const steps = stepsForFormat(format);
  const i = steps.indexOf(current as WizardStepType);
  if (i < 0) return steps[0] ?? null;
  return steps[i + 1] ?? null;
}

/**
 * The step before `current`. Falls back to the format picker, which is
 * always reachable — an operator must never be able to strand themselves
 * mid-flow with no way back.
 */
export function previousStep(
  format: string,
  current: WizardStepId,
): WizardStepId {
  const steps = stepsForFormat(format);
  const i = steps.indexOf(current as WizardStepType);
  if (i <= 0) return FORMAT_PICKER_STEP;
  return steps[i - 1];
}

/** 1-based position and total, for a progress indicator. */
export function stepPosition(
  format: string,
  current: WizardStepId,
): { index: number; total: number } {
  const steps = stepsForFormat(format);
  const i = steps.indexOf(current as WizardStepType);
  return { index: i < 0 ? 0 : i + 1, total: steps.length };
}
