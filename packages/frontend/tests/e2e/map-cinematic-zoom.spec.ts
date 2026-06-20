import { test, expect } from "@playwright/test";

// Runs against the dev server (playwright webServer starts `npm run dev`).
// NOTE: enable the feature for this run with NEXT_PUBLIC_CINEMATIC_ZOOM=true.
test.describe("Map cinematic zoom", () => {
  test("map loads and selecting a region does not crash", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    await page.goto("/map");
    const canvas = page.locator("canvas.mapboxgl-canvas");
    await expect(canvas).toBeVisible({ timeout: 20000 });
    await page.waitForTimeout(3000); // let layers settle

    const box = await canvas.boundingBox();
    if (box) {
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      await page.waitForTimeout(2500); // allow the cinematic fly
    }

    await expect(canvas).toBeVisible();
    expect(errors, errors.join("\n")).toHaveLength(0);
  });
});
