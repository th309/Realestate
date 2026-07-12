import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, act } from "@testing-library/react";

vi.mock("@/lib/analytics/tracker", () => ({ trackEvent: vi.fn() }));

const mockUseInstallPrompt = vi.fn();
vi.mock("@/lib/pwa/use-install-prompt", () => ({
  useInstallPrompt: (...args: unknown[]) => mockUseInstallPrompt(...args),
}));

import { InstallBanner } from "../InstallBanner";
import { recordInstallValueMoment } from "@/lib/pwa/install-value-moment";

function mockInstallPromptState(
  overrides: Partial<{
    canPromptNatively: boolean;
    isIos: boolean;
    isInstalled: boolean;
  }> = {},
) {
  mockUseInstallPrompt.mockReturnValue({
    canPromptNatively: false,
    promptInstall: vi.fn(),
    isIos: true,
    isInstalled: false,
    installOutcome: null,
    ...overrides,
  });
}

describe("InstallBanner", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    mockInstallPromptState();
  });

  it("stays hidden below the value-moment eligibility threshold", () => {
    render(<InstallBanner />);
    expect(
      screen.queryByRole("dialog", { name: "Install PropertyIQ" }),
    ).not.toBeInTheDocument();
  });

  it("becomes visible without a reload once a same-tab value moment crosses the threshold", () => {
    render(<InstallBanner />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    // Simulates crossing the threshold via client-side nav (e.g. viewing a
    // second report) in the same tab, with no remount of InstallBanner.
    act(() => {
      recordInstallValueMoment();
      recordInstallValueMoment();
    });

    expect(
      screen.getByRole("dialog", { name: "Install PropertyIQ" }),
    ).toBeInTheDocument();
  });

  it("never shows once already installed, even above the threshold", () => {
    mockInstallPromptState({ isInstalled: true });
    render(<InstallBanner />);

    act(() => {
      recordInstallValueMoment();
      recordInstallValueMoment();
    });

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
