import type { Persona } from "@/lib/data";

export type SandboxStepId = "step1" | "step2" | "step3";

export const SANDBOX_STEP_ORDER: SandboxStepId[] = ["step1", "step2", "step3"];

export interface StepContent {
  id: SandboxStepId;
  targetSelector: string;
  title: string;
  body: string;
  placement: "top" | "bottom" | "left" | "right";
  personaBody?: Partial<Record<Persona, string>>;
}

const CONTENT: Record<SandboxStepId, StepContent> = {
  step1: {
    id: "step1",
    targetSelector: '[data-tour="search-bar"]',
    title: "You picked your market — let's go",
    body: "PropertyIQ has loaded real data for your market. Click anywhere to continue.",
    placement: "bottom",
    personaBody: {
      agent:
        "PropertyIQ has loaded real data for your farm. Click anywhere to keep going.",
      investor:
        "PropertyIQ has loaded real cashflow + demand data for this market. Click anywhere to keep going.",
      homebuyer:
        "PropertyIQ has loaded real prices + trends for this market. Click anywhere to keep going.",
    },
  },
  step2: {
    id: "step2",
    targetSelector: '[data-tour="propertyiq-score"]',
    title: "Your market's PropertyIQ Score",
    body: "A 0-100 signal of market demand relative to the state average. Higher is stronger.",
    placement: "right",
    personaBody: {
      agent:
        "A 0-100 score you can put in front of a client. Higher means the market is moving — listings sell faster, often above ask.",
      investor:
        "Your investment signal. Higher scores mean stronger demand and competition for inventory.",
      homebuyer:
        "A quick read on how competitive this market is right now. Higher means more competition for buyers.",
    },
  },
  step3: {
    id: "step3",
    targetSelector: '[data-tour="compare-grid"]',
    title: "How your market stacks up",
    body: "PropertyIQ auto-picked the closest peer market for a side-by-side. Click Continue when ready.",
    placement: "top",
    personaBody: {
      agent:
        "PropertyIQ auto-picked the closest peer for a side-by-side — useful when positioning a listing or briefing a buyer client. Click Continue when ready.",
    },
  },
};

export function getStepContent(
  stepId: SandboxStepId,
  persona: Persona | null,
): StepContent {
  const c = CONTENT[stepId];
  if (!c) throw new Error(`Unknown step id: ${stepId}`);
  const body = (persona && c.personaBody?.[persona]) ?? c.body;
  return { ...c, body };
}

export function nextSandboxStep(current: SandboxStepId): SandboxStepId | null {
  const i = SANDBOX_STEP_ORDER.indexOf(current);
  return i >= 0 && i < SANDBOX_STEP_ORDER.length - 1
    ? SANDBOX_STEP_ORDER[i + 1]
    : null;
}
