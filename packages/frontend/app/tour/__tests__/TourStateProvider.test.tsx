import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { TourStateProvider, useTour } from "../TourStateProvider";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(""),
  usePathname: () => "/tour",
}));

function Probe() {
  const { session } = useTour();
  return <div data-testid="phase">{session.phase}</div>;
}

describe("TourStateProvider", () => {
  it("provides initial session at persona phase by default", () => {
    render(
      <TourStateProvider>
        <Probe />
      </TourStateProvider>,
    );
    expect(screen.getByTestId("phase").textContent).toBe("persona");
  });

  it("throws when useTour is called outside the provider", () => {
    function Probe2() {
      useTour();
      return null;
    }
    // Suppress React error boundary noise
    const orig = console.error;
    console.error = vi.fn();
    expect(() => render(<Probe2 />)).toThrow(/useTour must be used within/);
    console.error = orig;
  });
});
