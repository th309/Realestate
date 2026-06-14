import { describe, it, expect } from "vitest";

describe("MarketPage integrates TourSpotlight", () => {
  it("the page references TourSpotlight with stepId=step2", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const src = fs.readFileSync(path.resolve(__dirname, "../page.tsx"), "utf8");
    expect(src).toMatch(/TourSpotlight/);
    expect(src).toMatch(/stepId="step2"/);
  });
});
