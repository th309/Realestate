import { describe, it, expect } from "vitest";
import { VALID_SOURCES } from "../sources";

describe("newsletter VALID_SOURCES", () => {
  it("accepts the persona-tagged SEO capture sources", () => {
    expect(VALID_SOURCES).toContain("seo-investor");
    expect(VALID_SOURCES).toContain("seo-homebuyer");
    expect(VALID_SOURCES).toContain("seo-agent");
  });

  it("retains the original capture sources", () => {
    expect(VALID_SOURCES).toContain("homepage");
    expect(VALID_SOURCES).toContain("city-page");
    expect(VALID_SOURCES).toContain("exit-intent");
  });
});
