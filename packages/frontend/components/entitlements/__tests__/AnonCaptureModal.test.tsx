// packages/frontend/components/entitlements/__tests__/AnonCaptureModal.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

const pushSpy = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushSpy }),
}));
vi.mock("@/lib/entitlements/api", () => ({ trackPaywallEvent: vi.fn() }));
const signInWithOAuth = vi.fn().mockResolvedValue({ error: null });
vi.mock("@/lib/supabase/client", () => ({
  createSupabaseBrowserClient: () => ({ auth: { signInWithOAuth } }),
}));

import { AnonCaptureModal } from "../AnonCaptureModal";

describe("AnonCaptureModal", () => {
  beforeEach(() => {
    pushSpy.mockClear();
    signInWithOAuth.mockClear();
  });

  it("shows the feature name in the heading", () => {
    render(
      <AnonCaptureModal
        featureName="Cap Rate"
        returnTo="/map?metric=cap_rate"
        onDismiss={() => {}}
      />,
    );
    expect(screen.getByText(/Cap Rate/)).toBeTruthy();
  });

  it("routes email submit to signup with email + redirect params", () => {
    render(
      <AnonCaptureModal
        featureName="Cap Rate"
        returnTo="/map?metric=cap_rate"
        onDismiss={() => {}}
      />,
    );
    fireEvent.change(screen.getByPlaceholderText("you@example.com"), {
      target: { value: "lead@test.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));
    expect(pushSpy).toHaveBeenCalledWith(
      "/auth/sign-up?email=lead%40test.com&redirect=%2Fmap%3Fmetric%3Dcap_rate",
    );
  });

  it("dismisses on X button click", () => {
    const onDismiss = vi.fn();
    render(
      <AnonCaptureModal
        featureName="Cap Rate"
        returnTo="/map"
        onDismiss={onDismiss}
      />,
    );
    fireEvent.click(screen.getByLabelText("Close"));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("dismisses on Escape", () => {
    const onDismiss = vi.fn();
    render(
      <AnonCaptureModal
        featureName="Cap Rate"
        returnTo="/map"
        onDismiss={onDismiss}
      />,
    );
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("starts Google OAuth with a callback carrying tos=1 and next", () => {
    render(
      <AnonCaptureModal
        featureName="Cap Rate"
        returnTo="/map?metric=cap_rate"
        onDismiss={() => {}}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /google/i }));
    expect(signInWithOAuth).toHaveBeenCalledTimes(1);
    const arg = signInWithOAuth.mock.calls[0][0];
    expect(arg.provider).toBe("google");
    expect(arg.options.redirectTo).toContain("tos=1");
    expect(arg.options.redirectTo).toContain(
      "next=" + encodeURIComponent("/map?metric=cap_rate"),
    );
  });
});
