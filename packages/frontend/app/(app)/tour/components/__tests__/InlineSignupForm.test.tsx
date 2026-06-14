import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { InlineSignupForm } from "../InlineSignupForm";

const replaceSpy = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceSpy }),
}));

const mutateAsyncSpy = vi.fn();
let mockMutationState: any = {
  isPending: false,
  isError: false,
  isSuccess: false,
  error: null,
  data: null,
  mutateAsync: mutateAsyncSpy,
};

vi.mock("@/lib/data", () => ({
  useTourSignup: () => mockMutationState,
}));

let mockSession: any = {
  sessionId: "sess-abc",
  persona: "agent",
  market: { geoLevel: "metro", geoId: "16740", name: "Charlotte, NC" },
};
vi.mock("../../TourStateProvider", () => ({
  useTour: () => ({ session: mockSession }),
}));

describe("InlineSignupForm", () => {
  beforeEach(() => {
    mutateAsyncSpy.mockReset();
    replaceSpy.mockReset();
    mockMutationState = {
      isPending: false,
      isError: false,
      isSuccess: false,
      error: null,
      data: null,
      mutateAsync: mutateAsyncSpy,
    };
    mockSession = {
      sessionId: "sess-abc",
      persona: "agent",
      market: { geoLevel: "metro", geoId: "16740", name: "Charlotte, NC" },
    };
  });

  it("renders headline + email/password fields + submit button", () => {
    render(<InlineSignupForm />);
    expect(screen.getByText(/Save Charlotte/)).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText(/you@brokerage.com/i),
    ).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText(/Choose a password/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Save my report/i }),
    ).toBeInTheDocument();
  });

  it("collapses to a sticky pill when ✕ is clicked, restores on click", () => {
    render(<InlineSignupForm />);
    fireEvent.click(screen.getByLabelText(/Dismiss signup/i));
    const pill = screen.getByRole("button", { name: /Sign up to save/i });
    expect(pill).toBeInTheDocument();
    fireEvent.click(pill);
    expect(
      screen.getByRole("button", { name: /Save my report/i }),
    ).toBeInTheDocument();
  });

  it("submits with email+password+tourSessionId on form submit", async () => {
    mutateAsyncSpy.mockResolvedValue({
      userId: "u1",
      reportId: "r1",
      needsEmailConfirmation: false,
      magicLink: null,
    });
    render(<InlineSignupForm />);
    fireEvent.change(screen.getByPlaceholderText(/you@brokerage.com/i), {
      target: { value: "newuser@test.local" },
    });
    fireEvent.change(screen.getByPlaceholderText(/Choose a password/i), {
      target: { value: "hunter2hunter2" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Save my report/i }));
    await waitFor(() => {
      expect(mutateAsyncSpy).toHaveBeenCalledWith({
        email: "newuser@test.local",
        password: "hunter2hunter2",
        tourSessionId: "sess-abc",
      });
    });
  });

  it("redirects to /tour?phase=celebrate when needsEmailConfirmation=false", async () => {
    mutateAsyncSpy.mockResolvedValue({
      userId: "u1",
      reportId: "r1",
      needsEmailConfirmation: false,
      magicLink: null,
    });
    render(<InlineSignupForm />);
    fireEvent.change(screen.getByPlaceholderText(/you@brokerage.com/i), {
      target: { value: "u@x.test" },
    });
    fireEvent.change(screen.getByPlaceholderText(/Choose a password/i), {
      target: { value: "hunter2hunter2" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Save my report/i }));
    await waitFor(() => {
      expect(replaceSpy).toHaveBeenCalledWith(
        expect.stringMatching(/\/tour\?.*phase=celebrate/),
      );
    });
    expect(replaceSpy.mock.calls[0][0]).toContain("sessionId=sess-abc");
  });

  it("renders 'check your email' branch when needsEmailConfirmation=true", () => {
    mockMutationState = {
      ...mockMutationState,
      isSuccess: true,
      data: {
        userId: "u1",
        reportId: "r1",
        needsEmailConfirmation: true,
        magicLink: null,
      },
    };
    render(<InlineSignupForm />);
    expect(screen.getByText(/check your email/i)).toBeInTheDocument();
  });

  it("renders error message when signup fails", () => {
    mockMutationState = {
      ...mockMutationState,
      isError: true,
      error: new Error("email already exists"),
    };
    render(<InlineSignupForm />);
    expect(screen.getByText(/email already exists/i)).toBeInTheDocument();
  });

  it("disables submit while pending", () => {
    mockMutationState = { ...mockMutationState, isPending: true };
    render(<InlineSignupForm />);
    const button = screen.getByRole("button", { name: /Saving/i });
    expect(button).toBeDisabled();
  });

  it("does not hardcode hex colors", () => {
    const { container } = render(<InlineSignupForm />);
    expect(container.innerHTML).not.toMatch(/#[0-9A-Fa-f]{6}/);
  });
});
