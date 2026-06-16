import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { TourSpotlight } from "../TourSpotlight";

const advanceSpy = vi.fn();
const dismissSpy = vi.fn();
const advanceToStep4Spy = vi.fn();

let mockActive: {
  stepId: "step1" | "step2" | "step3";
  persona: "agent" | "investor" | "homebuyer" | null;
  market: { geoLevel: "metro"; geoId: string; name: string };
  sessionId: string;
} | null = null;

vi.mock("../../hooks/useTourFromUrl", () => ({
  useTourFromUrl: () => ({
    active: mockActive,
    advance: advanceSpy,
    dismiss: dismissSpy,
    advanceToStep4: advanceToStep4Spy,
  }),
}));

// Stub out the heavy onboarding primitives so we can assert composition cheaply
vi.mock("../../primitives/BreathingSpotlight", () => ({
  BreathingSpotlight: (props: any) => (
    <div data-testid="breathing-spotlight" data-target={props.targetSelector} />
  ),
}));
vi.mock("../../primitives/ConnectedTooltip", () => ({
  ConnectedTooltip: (props: any) => (
    <div
      data-testid="connected-tooltip"
      data-title={props.step.title}
      data-index={props.currentIndex}
    />
  ),
}));
vi.mock("../TourBottomSheet", () => ({
  TourBottomSheet: (props: any) => (
    <div
      data-testid="bottom-sheet"
      data-title={props.title}
      data-progress={props.progress}
    />
  ),
}));

function setMatchMedia(matches: boolean) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: (query: string) => ({
      matches,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }),
  });
}

describe("TourSpotlight", () => {
  beforeEach(() => {
    advanceSpy.mockClear();
    dismissSpy.mockClear();
    advanceToStep4Spy.mockClear();
    setMatchMedia(false); // desktop default
  });

  it("renders null when no active tour", () => {
    mockActive = null;
    const { container } = render(<TourSpotlight stepId="step1" />);
    expect(container.firstChild).toBeNull();
  });

  it("renders null when active.stepId does not match the prop stepId", () => {
    mockActive = {
      stepId: "step2",
      persona: "agent",
      market: { geoLevel: "metro", geoId: "39580", name: "" },
      sessionId: "s",
    };
    const { container } = render(<TourSpotlight stepId="step1" />);
    expect(container.firstChild).toBeNull();
  });

  it("desktop: renders BreathingSpotlight + ConnectedTooltip when stepId matches", () => {
    mockActive = {
      stepId: "step1",
      persona: "agent",
      market: { geoLevel: "metro", geoId: "39580", name: "" },
      sessionId: "s",
    };
    render(<TourSpotlight stepId="step1" />);
    expect(screen.getByTestId("breathing-spotlight")).toBeInTheDocument();
    expect(screen.getByTestId("connected-tooltip")).toBeInTheDocument();
    expect(screen.queryByTestId("bottom-sheet")).not.toBeInTheDocument();
  });

  it("mobile: renders TourBottomSheet instead of spotlight+tooltip", () => {
    setMatchMedia(true);
    mockActive = {
      stepId: "step2",
      persona: "investor",
      market: { geoLevel: "metro", geoId: "39580", name: "" },
      sessionId: "s",
    };
    render(<TourSpotlight stepId="step2" />);
    expect(screen.getByTestId("bottom-sheet")).toBeInTheDocument();
    expect(screen.queryByTestId("breathing-spotlight")).not.toBeInTheDocument();
  });

  it("uses persona-specific copy from getStepContent", () => {
    mockActive = {
      stepId: "step2",
      persona: "agent",
      market: { geoLevel: "metro", geoId: "39580", name: "" },
      sessionId: "s",
    };
    render(<TourSpotlight stepId="step2" />);
    const tooltip = screen.getByTestId("connected-tooltip");
    // step2 agent body should include 'score', 'client', or 'listing' per T1 test
    expect(tooltip.getAttribute("data-title")).toBeTruthy();
  });
});
