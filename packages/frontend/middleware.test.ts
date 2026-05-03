import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Set env BEFORE importing middleware so its createServerClient call doesn't
// throw on the non-null assertions (`!`) for the URL/key.
process.env.NEXT_PUBLIC_SUPABASE_URL = "http://localhost:54321";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";

// Mock Supabase SSR before middleware import. Returns a stub client whose
// `auth.getUser()` resolves to no user (unauthenticated) and whose `from()`
// query builder returns null data, so the admin-row check is a no-op.
vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          single: vi.fn().mockResolvedValue({ data: null }),
        }),
      }),
    }),
  }),
}));

// Import AFTER mocks are registered.
import { middleware } from "./middleware";

function makeRequest(path: string, method = "GET"): NextRequest {
  const url = new URL(`http://localhost:3000${path}`);
  return new NextRequest(url, { method });
}

describe("middleware /get-started redirect", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("308 redirects /get-started -> /tour", async () => {
    const res = await middleware(makeRequest("/get-started"));
    expect(res.status).toBe(308);
    expect(res.headers.get("location")).toBe("http://localhost:3000/tour");
  });

  it("preserves query string on /get-started -> /tour redirect", async () => {
    const res = await middleware(makeRequest("/get-started?next=%2Freports"));
    expect(res.status).toBe(308);
    const loc = res.headers.get("location");
    expect(loc).toContain("/tour");
    expect(loc).toContain("next=%2Freports");
  });

  it("redirects /get-started/anything -> /tour (subpath collapsed)", async () => {
    const res = await middleware(makeRequest("/get-started/foo"));
    expect(res.status).toBe(308);
    // Implementation collapses any /get-started/* to plain /tour
    // (sets url.pathname = "/tour" without preserving the subpath).
    expect(res.headers.get("location")).toBe("http://localhost:3000/tour");
  });

  it("does not redirect /tour itself (no loop)", async () => {
    const res = await middleware(makeRequest("/tour"));
    // /tour is not protected and not an auth route, so this is a passthrough
    // (NextResponse.next). Must NOT be a 308 — that would create a redirect loop.
    expect(res.status).not.toBe(308);
  });

  it("still redirects unauthenticated users from protected /dashboard to /auth/sign-in", async () => {
    const res = await middleware(makeRequest("/dashboard"));
    // 307 default for NextResponse.redirect without explicit status
    expect([307, 308]).toContain(res.status);
    const loc = res.headers.get("location") ?? "";
    expect(loc).toContain("/auth/sign-in");
    expect(loc).toContain("redirect=%2Fdashboard");
  });
});
