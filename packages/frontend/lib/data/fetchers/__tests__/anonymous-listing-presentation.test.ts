import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  generateAnonymousListingPresentation,
  TourRateLimitError,
} from "../anonymous-listing-presentation";

const fetchMock = vi.fn();
beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
});

const validInput = {
  sessionId: "sess-123",
  persona: "agent" as const,
  market: { geoLevel: "city" as const, geoId: "cary-nc", name: "Cary, NC" },
};

describe("generateAnonymousListingPresentation", () => {
  it("returns the parsed body on 200 OK", async () => {
    fetchMock.mockResolvedValue({
      status: 200,
      ok: true,
      json: () =>
        Promise.resolve({
          reportId: "anon-rpt-1",
          sessionId: "sess-123",
          watermark: "demo",
          expiresAt: "2030-01-01",
          claimable: true,
          report: { sections: [] },
        }),
    });
    const result = await generateAnonymousListingPresentation(validInput);
    expect(result.reportId).toBe("anon-rpt-1");
  });

  it("throws TourRateLimitError with retryAfter + signupUrl from body on 429", async () => {
    fetchMock.mockResolvedValue({
      status: 429,
      ok: false,
      json: () =>
        Promise.resolve({
          retryAfter: 3600,
          signupUrl: "/auth/sign-up?from=tour",
        }),
    });
    await expect(
      generateAnonymousListingPresentation(validInput),
    ).rejects.toThrow(TourRateLimitError);
    fetchMock.mockResolvedValue({
      status: 429,
      ok: false,
      json: () =>
        Promise.resolve({
          retryAfter: 3600,
          signupUrl: "/auth/sign-up?from=tour",
        }),
    });
    try {
      await generateAnonymousListingPresentation(validInput);
    } catch (e) {
      expect((e as TourRateLimitError).retryAfter).toBe(3600);
      expect((e as TourRateLimitError).signupUrl).toBe(
        "/auth/sign-up?from=tour",
      );
    }
  });

  it("uses sensible defaults for retryAfter + signupUrl on 429 without body", async () => {
    fetchMock.mockResolvedValue({
      status: 429,
      ok: false,
      json: () => Promise.reject(new Error("not json")),
    });
    try {
      await generateAnonymousListingPresentation(validInput);
      throw new Error("should have thrown");
    } catch (e) {
      expect((e as TourRateLimitError).retryAfter).toBe(86400);
      expect((e as TourRateLimitError).signupUrl).toBe("/auth/sign-up");
    }
  });

  it("throws Error with status code on other non-OK responses", async () => {
    fetchMock.mockResolvedValue({
      status: 503,
      ok: false,
      json: () => Promise.resolve({ error: "service_unavailable" }),
    });
    await expect(
      generateAnonymousListingPresentation(validInput),
    ).rejects.toThrow(/503/);
  });

  it("sends credentials: include for cookie round-trip", async () => {
    fetchMock.mockResolvedValue({
      status: 200,
      ok: true,
      json: () =>
        Promise.resolve({
          reportId: "r",
          sessionId: "s",
          watermark: "w",
          expiresAt: "e",
          claimable: true,
          report: { sections: [] },
        }),
    });
    await generateAnonymousListingPresentation(validInput);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ credentials: "include", method: "POST" }),
    );
  });
});
