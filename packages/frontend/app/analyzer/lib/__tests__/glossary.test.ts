import { describe, it, expect } from "vitest";
import { GLOSSARY, getGlossaryEntry, type GlossaryKey } from "../glossary";

describe("glossary", () => {
  const allKeys = Object.keys(GLOSSARY) as GlossaryKey[];

  it("has 30+ entries", () => {
    expect(allKeys.length).toBeGreaterThanOrEqual(30);
  });

  it.each(allKeys)("entry %s has all required fields", (key) => {
    const e = GLOSSARY[key];
    expect(e.name).toBeTruthy();
    expect(e.formula).toBeTruthy();
    expect(e.plain).toBeTruthy();
    expect(e.whyMatters).toBeTruthy();
  });

  it.each(allKeys)(
    "entry %s plain explanation is sentence-length (10–250 chars)",
    (key) => {
      const len = GLOSSARY[key].plain.length;
      expect(len).toBeGreaterThanOrEqual(10);
      expect(len).toBeLessThanOrEqual(250);
    },
  );

  it("getGlossaryEntry returns the entry by key", () => {
    expect(getGlossaryEntry("cap_rate").name).toBe("Cap Rate");
  });
});
