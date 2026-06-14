import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const revalidatePath = vi.fn();
const revalidateTag = vi.fn();
vi.mock("next/cache", () => ({
  revalidatePath: (...a: unknown[]) => revalidatePath(...a),
  revalidateTag: (...a: unknown[]) => revalidateTag(...a),
}));

import { POST } from "../route";

function req(secret?: string): Request {
  return new Request("http://localhost/api/revalidate-markets", {
    method: "POST",
    headers: secret ? { "x-revalidate-secret": secret } : {},
  });
}

describe("POST /api/revalidate-markets", () => {
  beforeEach(() => {
    revalidatePath.mockClear();
    revalidateTag.mockClear();
    process.env.REVALIDATE_SECRET = "test-secret";
  });
  afterEach(() => {
    delete process.env.REVALIDATE_SECRET;
  });

  it("401s on a wrong secret and revalidates nothing", async () => {
    const res = await POST(req("wrong"));
    expect(res.status).toBe(401);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("revalidates every market route pattern with the correct secret", async () => {
    const res = await POST(req("test-secret"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.revalidated).toBe(true);
    expect(revalidateTag).toHaveBeenCalledWith("piq-market-data");
    expect(revalidatePath).toHaveBeenCalledWith("/markets/[slug]", "page");
    expect(revalidatePath).toHaveBeenCalledWith(
      "/markets/county/[slug]",
      "page",
    );
    expect(revalidatePath).toHaveBeenCalledWith("/markets/zip/[slug]", "page");
    expect(revalidatePath).toHaveBeenCalledWith(
      "/markets/state/[state]",
      "page",
    );
    expect(revalidatePath).toHaveBeenCalledTimes(5); // 4 dynamic routes + /markets index
  });

  it("503s when REVALIDATE_SECRET is not configured", async () => {
    delete process.env.REVALIDATE_SECRET;
    const res = await POST(req("anything"));
    expect(res.status).toBe(503);
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
