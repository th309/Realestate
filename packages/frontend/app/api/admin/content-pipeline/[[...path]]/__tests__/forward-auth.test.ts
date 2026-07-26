import { describe, it, expect, vi } from "vitest";
import { resolveForwardAuthHeader } from "../forward-auth";

function req(method: string, headers: Record<string, string> = {}) {
  return { method, headers: new Headers(headers) };
}

describe("resolveForwardAuthHeader", () => {
  it("passes a client-supplied Authorization header through untouched (fetchAPI path)", async () => {
    const mint = vi.fn();
    const out = await resolveForwardAuthHeader(
      req("GET", { authorization: "Bearer client-token" }),
      mint,
    );
    expect(out).toBe("Bearer client-token");
    expect(mint).not.toHaveBeenCalled();
  });

  it("mints a Bearer from the cookie session for a headerless GET (image load)", async () => {
    const out = await resolveForwardAuthHeader(
      req("GET"),
      async () => "cookie-token",
    );
    expect(out).toBe("Bearer cookie-token");
  });

  it("forwards unauthenticated (null) when there's no session", async () => {
    const out = await resolveForwardAuthHeader(req("GET"), async () => null);
    expect(out).toBeNull();
  });

  it("never injects for non-GET requests (those always go through fetchAPI)", async () => {
    const mint = vi.fn();
    const out = await resolveForwardAuthHeader(req("POST"), mint);
    expect(out).toBeNull();
    expect(mint).not.toHaveBeenCalled();
  });

  it("still prefers a client header over the cookie mint on a GET", async () => {
    const mint = vi.fn(async () => "cookie-token");
    const out = await resolveForwardAuthHeader(
      req("GET", { authorization: "Bearer client-token" }),
      mint,
    );
    expect(out).toBe("Bearer client-token");
    expect(mint).not.toHaveBeenCalled();
  });

  it("swallows a mint failure and forwards unauthenticated", async () => {
    const out = await resolveForwardAuthHeader(req("GET"), async () => {
      throw new Error("no cookie context");
    });
    expect(out).toBeNull();
  });
});
