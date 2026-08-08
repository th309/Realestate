import { describe, it, expect } from "vitest";
import { buildPostImageSpec } from "../generate-post-images";

describe("buildPostImageSpec", () => {
  it("derives an output path from the slug", () => {
    const spec = buildPostImageSpec({
      slug: "best-real-estate-markets-appreciation-2026",
      title: "Best Real Estate Markets for Appreciation in 2026",
      category: "market-analysis",
      headlineValue: "99",
      headlineLabel: "Rochester, NY · forecast +4.3%",
    });
    expect(spec.outputPath).toBe(
      "public/images/blog/best-real-estate-markets-appreciation-2026.png",
    );
  });

  it("renders at 16:9 for the card grid", () => {
    const spec = buildPostImageSpec({ slug: "s", title: "T", category: "c" });
    expect(spec.width / spec.height).toBeCloseTo(16 / 9, 2);
  });

  it("puts the headline number in the spec when given one", () => {
    const spec = buildPostImageSpec({
      slug: "s",
      title: "T",
      category: "c",
      headlineValue: "8.4%",
    });
    expect(spec.headlineValue).toBe("8.4%");
  });

  it("omits the headline block when no value is given", () => {
    const spec = buildPostImageSpec({ slug: "s", title: "T", category: "c" });
    expect(spec.headlineValue).toBeUndefined();
  });
});

/**
 * Blog frontmatter stores the slug as a ROUTE ("/blog/foo"), but the image is
 * written to a flat filename. Without normalisation the output path would gain
 * a phantom nested directory and the frontmatter `image:` would point nowhere.
 */
describe("buildPostImageSpec normalises the frontmatter slug", () => {
  it.each([
    ["/blog/foo-bar", "public/images/blog/foo-bar.png"],
    ["blog/foo-bar", "public/images/blog/foo-bar.png"],
    ["/foo-bar/", "public/images/blog/foo-bar.png"],
    ["foo-bar", "public/images/blog/foo-bar.png"],
  ])("maps %s to %s", (slug, expected) => {
    expect(
      buildPostImageSpec({ slug, title: "T", category: "c" }).outputPath,
    ).toBe(expected);
  });

  it("exposes the public URL the frontmatter should reference", () => {
    const spec = buildPostImageSpec({
      slug: "/blog/foo-bar",
      title: "T",
      category: "c",
    });
    expect(spec.publicUrl).toBe("/images/blog/foo-bar.png");
  });

  it("rejects a slug that normalises to nothing", () => {
    expect(() =>
      buildPostImageSpec({ slug: "/blog/", title: "T", category: "c" }),
    ).toThrow(/slug/i);
  });
});
