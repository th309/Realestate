import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { PersonaCaptureBlock } from "../PersonaCaptureBlock";

// Stub global fetch
const mockFetch = vi.fn();
beforeEach(() => {
  vi.stubGlobal("fetch", mockFetch);
  mockFetch.mockReset();
});

describe("PersonaCaptureBlock", () => {
  it("renders three role buttons", () => {
    render(<PersonaCaptureBlock geoName="Austin, TX" />);
    expect(screen.getByRole("button", { name: "Investor" })).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Agent / Realtor" }),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "Home Buyer" })).toBeTruthy();
  });

  it("marks a role button as pressed when selected", () => {
    render(<PersonaCaptureBlock geoName="Austin, TX" />);
    const investorBtn = screen.getByRole("button", { name: "Investor" });
    expect(investorBtn.getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(investorBtn);
    expect(investorBtn.getAttribute("aria-pressed")).toBe("true");
  });

  it("submit button is disabled until role + email are both filled", () => {
    render(<PersonaCaptureBlock geoName="Austin, TX" />);
    const submitBtn = screen.getByRole("button", { name: "Get updates" });
    expect(submitBtn).toBeDisabled();

    // Select role only
    fireEvent.click(screen.getByRole("button", { name: "Investor" }));
    expect(submitBtn).toBeDisabled();

    // Add email
    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "test@example.com" },
    });
    expect(submitBtn).not.toBeDisabled();
  });

  it("POSTs to /api/newsletter with role + email + geo on submit", async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({}) });

    render(<PersonaCaptureBlock geoName="Austin, TX" source="test-source" />);
    fireEvent.click(screen.getByRole("button", { name: "Agent / Realtor" }));
    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "agent@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Get updates" }));

    await waitFor(() => expect(mockFetch).toHaveBeenCalledOnce());
    const [url, opts] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/newsletter");
    const body = JSON.parse(opts.body as string);
    expect(body.role).toBe("agent");
    expect(body.email).toBe("agent@example.com");
    expect(body.geo).toBe("Austin, TX");
    expect(body.source).toBe("test-source");
  });

  it("shows success message after successful submission", async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({}) });

    render(<PersonaCaptureBlock geoName="Austin, TX" />);
    fireEvent.click(screen.getByRole("button", { name: "Investor" }));
    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "invest@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Get updates" }));

    await waitFor(() => expect(screen.getByRole("status")).toBeTruthy());
    expect(screen.getByText("You're in!")).toBeTruthy();
  });

  it("shows an error message on API failure", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      json: async () => ({ message: "Email already subscribed" }),
    });

    render(<PersonaCaptureBlock geoName="Austin, TX" />);
    fireEvent.click(screen.getByRole("button", { name: "Home Buyer" }));
    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "buyer@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Get updates" }));

    await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());
    expect(screen.getByRole("alert").textContent).toContain(
      "Email already subscribed",
    );
  });
});
