import type { Persona } from "@/lib/data";

export type SandboxStepId = "step1" | "step2";
export const SANDBOX_STEP_ORDER: SandboxStepId[] = ["step1", "step2"];

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
    targetSelector: '[data-tour="propertyiq-score"]',
    title: "Your market's PropertyIQ Score",
    body: "A 0–100 read on demand vs. the state average. Higher is stronger — tap it to see what's driving it.",
    placement: "right",
    personaBody: {
      agent:
        "A 0–100 score you can put in front of a client. Higher = listings move faster, often above ask. Tap it to see what's driving it.",
      investor:
        "Your investment signal — higher means stronger demand and competition for inventory. Tap it to see what's driving it.",
      homebuyer:
        "A quick read on how competitive this market is right now. Tap it to see what's driving it.",
    },
  },
  step2: {
    id: "step2",
    targetSelector: '[data-tour="ai-assessment"]',
    title: "What's driving it",
    body: "PropertyIQ reads the market for you, in plain English — the story behind the number.",
    placement: "top",
    personaBody: {
      agent:
        "Talking points for your next client conversation, in plain English.",
      investor:
        "The thesis behind the score — momentum, supply, and pricing pressure in plain English.",
      homebuyer: "What this market means for you as a buyer, in plain English.",
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
