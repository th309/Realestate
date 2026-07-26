import { describe, it, expect, vi, beforeEach } from "vitest";

const fetchAPIRaw = vi.fn();
vi.mock("@/lib/data/fetchers/base", () => ({
  fetchAPIRaw: (...args: unknown[]) => fetchAPIRaw(...args),
}));

const { createRun } = await import("../create-run-api");

/**
 * What guards the payload KEY NAMES is the compiler, not this file: `createRun`
 * stringifies whatever object it's handed, so a runtime test here would pass
 * with any key at all. The real check is TypeScript's excess-property rule on
 * the call-site object literal — sending `params` instead of `infographicParams`
 * fails `tsc` with "Object literal may only specify known properties". That
 * matters because the backend validation pipe runs `whitelist: true` and would
 * otherwise strip an unknown key silently, turning a typo into a rejected run.
 *
 * These tests cover the parts the types can't see: the endpoint string and how
 * a rejection is surfaced.
 */
describe("createRun", () => {
  beforeEach(() => {
    fetchAPIRaw.mockReset();
    fetchAPIRaw.mockResolvedValue({
      json: async () => ({ success: true, data: { id: "run-1" } }),
    });
  });

  it("posts to the shared run-creation endpoint", async () => {
    await createRun({
      format: "infographic",
      marketQuery: "Using the map — Read the color scale",
      idempotencyKey: "key-1",
      infographicParams: {
        topic_slug: "how-to-map",
        task_number: 4,
        style_id: "editorial",
      },
    });

    const [path, init] = fetchAPIRaw.mock.calls[0] as [
      string,
      { method: string; body: string },
    ];
    expect(path).toBe("/api/admin/content-pipeline/runs");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body).infographicParams).toEqual({
      topic_slug: "how-to-map",
      task_number: 4,
      style_id: "editorial",
    });
  });

  it("returns the created run on success", async () => {
    const run = await createRun({
      format: "grade_reveal",
      marketQuery: "Austin, TX",
      idempotencyKey: "key-2",
    });
    expect(run).toEqual({ id: "run-1" });
  });

  it("throws the server's reason instead of returning undefined", async () => {
    fetchAPIRaw.mockResolvedValue({
      json: async () => ({
        success: false,
        error: "infographic runs require infographicParams",
      }),
    });

    await expect(
      createRun({
        format: "infographic",
        marketQuery: "Using the map",
        idempotencyKey: "key-3",
      }),
    ).rejects.toThrow("infographic runs require infographicParams");
  });
});
