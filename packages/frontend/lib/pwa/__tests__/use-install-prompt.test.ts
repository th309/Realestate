import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";

vi.mock("@/lib/analytics/tracker", () => ({ trackEvent: vi.fn() }));

import { trackEvent } from "@/lib/analytics/tracker";

const ORIGINAL_UA = window.navigator.userAgent;

function setUserAgent(ua: string) {
  Object.defineProperty(window.navigator, "userAgent", {
    value: ua,
    configurable: true,
  });
}

function setMaxTouchPoints(points: number) {
  Object.defineProperty(window.navigator, "maxTouchPoints", {
    value: points,
    configurable: true,
  });
}

function setStandalone(matches: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: query === "(display-mode: standalone)" ? matches : false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia;
}

function fireBeforeInstallPrompt(
  outcome: "accepted" | "dismissed" = "accepted",
) {
  const prompt = vi.fn().mockResolvedValue(undefined);
  const userChoice = Promise.resolve({ outcome, platform: "web" });
  const event = new Event("beforeinstallprompt", {
    cancelable: true,
  }) as Event & { prompt: typeof prompt; userChoice: typeof userChoice };
  event.prompt = prompt;
  event.userChoice = userChoice;
  window.dispatchEvent(event);
  return { prompt, event };
}

describe("useInstallPrompt", () => {
  beforeEach(() => {
    vi.resetModules();
    (trackEvent as ReturnType<typeof vi.fn>).mockClear();
    setStandalone(false);
    setUserAgent(ORIGINAL_UA);
    setMaxTouchPoints(0);
  });

  afterEach(() => {
    setUserAgent(ORIGINAL_UA);
    setMaxTouchPoints(0);
    setStandalone(false);
  });

  it("reports isInstalled from standalone display mode", async () => {
    setStandalone(true);
    const { useInstallPrompt } = await import("../use-install-prompt");
    const { result } = renderHook(() => useInstallPrompt());
    expect(result.current.isInstalled).toBe(true);
  });

  it("reports isInstalled false in a regular browser tab", async () => {
    const { useInstallPrompt } = await import("../use-install-prompt");
    const { result } = renderHook(() => useInstallPrompt());
    expect(result.current.isInstalled).toBe(false);
  });

  it("detects iOS from the UA string", async () => {
    setUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)");
    const { useInstallPrompt } = await import("../use-install-prompt");
    const { result } = renderHook(() => useInstallPrompt());
    expect(result.current.isIos).toBe(true);
  });

  it("detects iPadOS masquerading as macOS Safari via multi-touch", async () => {
    setUserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_6)");
    setMaxTouchPoints(5);
    const { useInstallPrompt } = await import("../use-install-prompt");
    const { result } = renderHook(() => useInstallPrompt());
    expect(result.current.isIos).toBe(true);
  });

  it("does not treat desktop macOS Safari (no touch) as iOS", async () => {
    setUserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_6)");
    setMaxTouchPoints(0);
    const { useInstallPrompt } = await import("../use-install-prompt");
    const { result } = renderHook(() => useInstallPrompt());
    expect(result.current.isIos).toBe(false);
  });

  it("does not treat Android Chrome as iOS", async () => {
    setUserAgent("Mozilla/5.0 (Linux; Android 14; Pixel 8)");
    const { useInstallPrompt } = await import("../use-install-prompt");
    const { result } = renderHook(() => useInstallPrompt());
    expect(result.current.isIos).toBe(false);
  });

  it("captures beforeinstallprompt, prevents its default, and exposes canPromptNatively", async () => {
    const { useInstallPrompt } = await import("../use-install-prompt");
    const { result } = renderHook(() => useInstallPrompt());
    expect(result.current.canPromptNatively).toBe(false);

    let captured!: ReturnType<typeof fireBeforeInstallPrompt>;
    act(() => {
      captured = fireBeforeInstallPrompt();
    });

    expect(result.current.canPromptNatively).toBe(true);
    expect(captured.event.defaultPrevented).toBe(true);
  });

  it("promptInstall() replays the stashed prompt, awaits userChoice, and records the outcome", async () => {
    const { useInstallPrompt } = await import("../use-install-prompt");
    const { result } = renderHook(() => useInstallPrompt());

    let captured!: ReturnType<typeof fireBeforeInstallPrompt>;
    act(() => {
      captured = fireBeforeInstallPrompt("accepted");
    });

    await act(async () => {
      await result.current.promptInstall();
    });

    expect(captured.prompt).toHaveBeenCalledTimes(1);
    expect(result.current.installOutcome).toBe("accepted");
    expect(result.current.canPromptNatively).toBe(false);
  });

  it("promptInstall() is a no-op when no prompt has been stashed", async () => {
    const { useInstallPrompt } = await import("../use-install-prompt");
    const { result } = renderHook(() => useInstallPrompt());

    await act(async () => {
      await result.current.promptInstall();
    });

    expect(result.current.installOutcome).toBe(null);
  });

  it("fires pwa.installed and flips isInstalled on the appinstalled event", async () => {
    const { useInstallPrompt } = await import("../use-install-prompt");
    const { result } = renderHook(() => useInstallPrompt());

    act(() => {
      window.dispatchEvent(new Event("appinstalled"));
    });

    expect(result.current.isInstalled).toBe(true);
    expect(result.current.canPromptNatively).toBe(false);
    expect(trackEvent).toHaveBeenCalledWith("pwa.installed", expect.anything());
  });

  it("stashes the prompt event at module scope so a hook mounted afterward still sees it", async () => {
    const { useInstallPrompt } = await import("../use-install-prompt");

    const first = renderHook(() => useInstallPrompt());
    act(() => {
      fireBeforeInstallPrompt();
    });
    first.unmount();

    const second = renderHook(() => useInstallPrompt());
    expect(second.result.current.canPromptNatively).toBe(true);
  });

  it("re-entrancy: two concurrent promptInstall() calls only invoke prompt() once", async () => {
    const { useInstallPrompt } = await import("../use-install-prompt");
    const { result } = renderHook(() => useInstallPrompt());

    let captured!: ReturnType<typeof fireBeforeInstallPrompt>;
    act(() => {
      captured = fireBeforeInstallPrompt("accepted");
    });

    // Simulates the banner and the header menu both triggering install
    // around the same time (or a double-click) before either has resolved.
    await act(async () => {
      await Promise.all([
        result.current.promptInstall(),
        result.current.promptInstall(),
      ]);
    });

    expect(captured.prompt).toHaveBeenCalledTimes(1);
    expect(result.current.installOutcome).toBe("accepted");
  });

  it("promptInstall() swallows a rejected prompt() instead of throwing", async () => {
    const { useInstallPrompt } = await import("../use-install-prompt");
    const { result } = renderHook(() => useInstallPrompt());

    const prompt = vi.fn().mockRejectedValue(new Error("already used"));
    const event = new Event("beforeinstallprompt", {
      cancelable: true,
    }) as Event & { prompt: typeof prompt; userChoice: Promise<unknown> };
    event.prompt = prompt;
    event.userChoice = Promise.resolve({
      outcome: "dismissed",
      platform: "web",
    });
    act(() => {
      window.dispatchEvent(event);
    });

    await expect(
      act(async () => {
        await result.current.promptInstall();
      }),
    ).resolves.not.toThrow();

    expect(prompt).toHaveBeenCalledTimes(1);
    // prompt() rejected before userChoice resolved, so the outcome was never recorded.
    expect(result.current.installOutcome).toBe(null);
  });
});
