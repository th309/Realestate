import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { Header } from "../Header";

// Focused on the AlertBell mount-gating decision Header owns: it should only
// mount the bell for paid tiers, matching the /alerts page's own gate
// (tier === pro/enterprise/admin). AlertBell's own rendering (badge, dropdown
// contents) is covered separately — here we only assert presence/absence.
let mockTier = "free";

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/lib/auth", () => ({
  useAuth: () => ({
    user: { email: "investor@example.com", user_metadata: {} },
    loading: false,
    signOut: vi.fn(),
  }),
}));

vi.mock("@/lib/entitlements", () => ({
  useEntitlements: () => ({ tier: mockTier, trial: null }),
}));

vi.mock("@/lib/data", () => ({
  useMyOrg: () => ({ org: null }),
}));

vi.mock("@/lib/pwa/use-install-prompt", () => ({
  useInstallPrompt: () => ({
    canPromptNatively: false,
    promptInstall: vi.fn(),
    isInstalled: true,
  }),
}));

vi.mock("@/lib/analytics/tracker", () => ({
  trackEvent: vi.fn(),
}));

vi.mock("@/components/alerts", () => ({
  AlertBell: () => <div data-testid="alert-bell-stub" />,
}));

describe("Header — AlertBell mount gating", () => {
  beforeEach(() => {
    mockTier = "free";
  });

  it.each(["pro", "enterprise", "admin"])(
    "mounts AlertBell for paid tier: %s",
    (tier) => {
      mockTier = tier;
      render(<Header />);
      expect(screen.getByTestId("alert-bell-stub")).toBeInTheDocument();
    },
  );

  it("does not mount AlertBell for the free tier", () => {
    mockTier = "free";
    render(<Header />);
    expect(screen.queryByTestId("alert-bell-stub")).not.toBeInTheDocument();
  });
});
