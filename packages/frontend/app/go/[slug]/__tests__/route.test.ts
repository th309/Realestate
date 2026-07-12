import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { GET } from "../route";

describe("short-link /go/[slug] route", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("redirects to target url and sets attribution cookie", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      json: () =>
        Promise.resolve({
          success: true,
          data: {
            run_id: "run-1",
            slug: "abcd1234",
            platform: "youtube_shorts",
            target_url: "/grade-reveal-signup",
          },
        }),
    }) as unknown as typeof fetch;

    const request = new Request("https://piq.sh/go/abcd1234");
    const response = await GET(request, {
      params: Promise.resolve({ slug: "abcd1234" }),
    });

    // NextResponse.redirect uses 307 by default; we set 302 explicitly.
    // Some Next.js versions normalize 302 → 307. Accept either.
    expect([302, 307]).toContain(response.status);
    expect(response.headers.get("location")).toContain("/grade-reveal-signup");
    const setCookie = response.headers.get("set-cookie");
    expect(setCookie).toContain("__piq_attr=");
  });

  it("404s on unknown slug", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ success: false, error: "not_found" }),
    }) as unknown as typeof fetch;

    const request = new Request("https://piq.sh/go/unknown");
    const response = await GET(request, {
      params: Promise.resolve({ slug: "unknown" }),
    });
    expect(response.status).toBe(404);
  });

  it("accepts sync params shape (no Promise)", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      json: () =>
        Promise.resolve({
          success: true,
          data: {
            run_id: "run-2",
            slug: "xyz98765",
            platform: "tiktok",
            target_url: "https://example.com/landing",
          },
        }),
    }) as unknown as typeof fetch;

    const request = new Request("https://piq.sh/go/xyz98765");
    // Legacy sync shape: the route's declared type is Promise-only (Next 16
    // ParamCheck), but runtime normalizes via Promise.resolve — keep testing it.
    const response = await GET(request, {
      params: { slug: "xyz98765" } as unknown as Promise<{ slug: string }>,
    });

    expect([302, 307]).toContain(response.status);
    expect(response.headers.get("location")).toBe(
      "https://example.com/landing",
    );
  });
});
