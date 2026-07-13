import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, act, fireEvent } from "@testing-library/react";

vi.mock("@/lib/analytics/tracker", () => ({ trackEvent: vi.fn() }));

const mockUseAuth = vi.fn();
vi.mock("@/lib/auth", () => ({
  useAuth: () => mockUseAuth(),
}));

const mockSubscribe = vi.fn();
const mockResubscribeIfNeeded = vi.fn();
const mockUsePushSubscription = vi.fn();
vi.mock("@/lib/pwa/use-push-subscription", () => ({
  usePushSubscription: (...args: unknown[]) => mockUsePushSubscription(...args),
}));

import { PushOptInPrompt } from "../PushOptInPrompt";
import { trackEvent } from "@/lib/analytics/tracker";

const MARKET_WATCHED_EVENT = "piq:market-watched";

function firePushState(
  overrides: Partial<{
    isSupported: boolean;
    permission: NotificationPermission | "unsupported";
  }> = {},
) {
  mockUsePushSubscription.mockReturnValue({
    isSupported: true,
    permission: "default",
    subscribing: false,
    subscribe: mockSubscribe,
    resubscribeIfNeeded: mockResubscribeIfNeeded,
    ...overrides,
  });
}

function setSignedIn(signedIn: boolean) {
  mockUseAuth.mockReturnValue({
    user: signedIn ? { id: "user-1" } : null,
  });
}

function dispatchMarketWatched() {
  act(() => {
    window.dispatchEvent(new Event(MARKET_WATCHED_EVENT));
  });
}

describe("PushOptInPrompt", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    mockSubscribe.mockResolvedValue(true);
    mockResubscribeIfNeeded.mockResolvedValue(true);
    firePushState();
    setSignedIn(true);
  });

  it("never shows on initial render, before any market-watched event", () => {
    render(<PushOptInPrompt />);
    expect(
      screen.queryByRole("dialog", { name: "Enable notifications" }),
    ).not.toBeInTheDocument();
  });

  it("shows after a market-watched event when signed in, supported, and permission is default", () => {
    render(<PushOptInPrompt />);
    dispatchMarketWatched();
    expect(
      screen.getByRole("dialog", { name: "Enable notifications" }),
    ).toBeInTheDocument();
    expect(trackEvent).toHaveBeenCalledWith(
      "pwa.push_prompt_shown",
      expect.anything(),
    );
  });

  it("stays hidden if the user is not signed in", () => {
    setSignedIn(false);
    render(<PushOptInPrompt />);
    dispatchMarketWatched();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("stays hidden when the Push API isn't supported", () => {
    firePushState({ isSupported: false });
    render(<PushOptInPrompt />);
    dispatchMarketWatched();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("stays hidden when permission was already denied", () => {
    firePushState({ permission: "denied" });
    render(<PushOptInPrompt />);
    dispatchMarketWatched();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(mockResubscribeIfNeeded).not.toHaveBeenCalled();
  });

  it("silently resubscribes instead of prompting when permission is already granted", () => {
    firePushState({ permission: "granted" });
    render(<PushOptInPrompt />);
    dispatchMarketWatched();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(mockResubscribeIfNeeded).toHaveBeenCalledTimes(1);
  });

  it("respects a prior dismissal recorded in localStorage across the whole session", () => {
    localStorage.setItem("piq-push-prompt-dismissed", "1");
    render(<PushOptInPrompt />);
    dispatchMarketWatched();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("dismiss button hides the prompt, persists the dismissal, and tracks it", () => {
    render(<PushOptInPrompt />);
    dispatchMarketWatched();
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "Dismiss notification prompt" }),
    );

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(localStorage.getItem("piq-push-prompt-dismissed")).toBe("1");
    expect(trackEvent).toHaveBeenCalledWith(
      "pwa.push_prompt_dismissed",
      expect.anything(),
    );
  });

  it("enable button calls subscribe(), tracks the opt-in, and hides on success", async () => {
    render(<PushOptInPrompt />);
    dispatchMarketWatched();

    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: "Turn on notifications" }),
      );
      await Promise.resolve();
    });

    expect(trackEvent).toHaveBeenCalledWith(
      "pwa.push_opt_in",
      expect.anything(),
    );
    expect(mockSubscribe).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("enable button keeps the prompt open if subscribe() fails (e.g. the user denied the native prompt)", async () => {
    mockSubscribe.mockResolvedValue(false);
    render(<PushOptInPrompt />);
    dispatchMarketWatched();

    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: "Turn on notifications" }),
      );
      await Promise.resolve();
    });

    expect(mockSubscribe).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});
