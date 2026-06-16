import { describe, it, expect, vi, afterEach } from "vitest";
import { fetchEntitlementsServer } from "../server";

afterEach(() => vi.restoreAllMocks());

describe("fetchEntitlementsServer", () => {
  it("returns null for an anonymous (no userId) request without fetching", async () => {
    const spy = vi.spyOn(global, "fetch");
    expect(await fetchEntitlementsServer(null)).toBeNull();
    expect(spy).not.toHaveBeenCalled();
  });

  it("resolves the tier from the backend using the x-user-id header", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          tier: "pro",
          access: {},
          trial: { active: true, daysRemaining: 14, tier: "pro" },
        }),
        { status: 200 },
      ),
    );
    const result = await fetchEntitlementsServer("user-123");
    expect(result?.tier).toBe("pro");
    expect(result?.loading).toBe(false);
  });

  it("returns null on a non-OK response (caller falls back to client refresh)", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response("nope", { status: 500 }),
    );
    expect(await fetchEntitlementsServer("user-123")).toBeNull();
  });
});
