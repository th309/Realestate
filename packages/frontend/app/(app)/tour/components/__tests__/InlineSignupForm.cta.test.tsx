import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn() }) }));
vi.mock("../../TourStateProvider", () => ({
  useTour: () => ({
    session: { sessionId: "s1", market: { name: "Austin, TX" } },
  }),
}));
vi.mock("@/lib/data", () => ({
  useTourSignup: () => ({
    mutateAsync: vi.fn(),
    isSuccess: true,
    isPending: false,
    isError: false,
    data: { needsEmailConfirmation: true },
    error: null,
  }),
}));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: any) => (
    <a href={typeof href === "string" ? href : ""} {...rest}>
      {children}
    </a>
  ),
}));

import { InlineSignupForm } from "../InlineSignupForm";

describe("InlineSignupForm confirmation panel", () => {
  it("offers a forward CTA to the dashboard", () => {
    const { container } = render(<InlineSignupForm />);
    expect(container.querySelector('a[href="/dashboard"]')).toBeTruthy();
  });
});
