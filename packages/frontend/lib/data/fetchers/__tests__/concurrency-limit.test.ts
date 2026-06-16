import { describe, it, expect } from "vitest";
import {
  withRequestLimit,
  MAX_CONCURRENT_REQUESTS,
  __getLimiterState,
} from "../concurrency-limit";

// jsdom defines `window`, so the limiter is active (not the server pass-through).

describe("withRequestLimit (browser request concurrency cap)", () => {
  it("never runs more than MAX_CONCURRENT_REQUESTS at once and completes every task", async () => {
    let current = 0;
    let peak = 0;

    const run = () =>
      withRequestLimit(
        () =>
          new Promise<void>((resolve) => {
            current++;
            peak = Math.max(peak, current);
            // A real async gap so the event loop admits queued tasks naturally.
            setTimeout(() => {
              current--;
              resolve();
            }, 10);
          }),
      );

    await Promise.all(Array.from({ length: 50 }, run));

    expect(peak).toBeLessThanOrEqual(MAX_CONCURRENT_REQUESTS);
    expect(peak).toBeGreaterThan(1); // genuinely parallel, not serialized
    expect(__getLimiterState()).toEqual({ inFlight: 0, queued: 0 });
  });

  it("releases the slot when a task rejects, so the queue never deadlocks", async () => {
    const results = await Promise.allSettled(
      Array.from({ length: 20 }, (_, i) =>
        withRequestLimit(() =>
          i % 2 === 0 ? Promise.reject(new Error("boom")) : Promise.resolve(i),
        ),
      ),
    );

    expect(results).toHaveLength(20);
    expect(results.filter((r) => r.status === "rejected")).toHaveLength(10);

    // A later task still runs — proves no slots were leaked by the rejections.
    await expect(withRequestLimit(() => Promise.resolve("ok"))).resolves.toBe(
      "ok",
    );

    // And the limiter has fully drained back to idle.
    expect(__getLimiterState()).toEqual({ inFlight: 0, queued: 0 });
  });
});
