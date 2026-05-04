import { describe, it, expect, vi, beforeEach } from "vitest";
import { signUpWithTour } from "../tour-signup";

describe("signUpWithTour", () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });

  const validInput = {
    email: "newuser@test.local",
    password: "hunter2hunter2",
    tourSessionId: "sess-1-12345",
  };

  it("POSTs to /api/anonymous/sign-up-with-tour with json body", async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        userId: "user-99",
        reportId: "rpt-1",
        needsEmailConfirmation: false,
        magicLink: "https://magic/abc",
      }),
    });

    const result = await signUpWithTour(validInput);

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/anonymous\/sign-up-with-tour$/),
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify(validInput),
        headers: { "content-type": "application/json" },
      }),
    );
    expect(result.userId).toBe("user-99");
    expect(result.reportId).toBe("rpt-1");
    expect(result.needsEmailConfirmation).toBe(false);
  });

  it("throws Error with server message on non-ok response", async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({ message: "email already exists" }),
    });

    await expect(signUpWithTour(validInput)).rejects.toThrow(
      /email already exists/,
    );
  });

  it("throws generic error when response body is not JSON", async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => {
        throw new Error("not json");
      },
    });

    await expect(signUpWithTour(validInput)).rejects.toThrow(
      /Sign-up failed: 500/,
    );
  });
});
