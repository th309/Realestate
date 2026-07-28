import { describe, it, expect } from "vitest";
import type { CopyFieldDeclaration } from "@propertyiq/video-template/formats";
import {
  chooseVariant,
  emptyCopyState,
  mergeSuggestions,
  resizeRepeating,
  setFieldValue,
  toSubmission,
} from "../copy-state";

const HOOK: CopyFieldDeclaration = {
  fieldId: "hookHeadline",
  label: "Hook",
  maxLength: 90,
  variants: 3,
};
const CALLOUT: CopyFieldDeclaration = {
  fieldId: "featureCallout",
  label: "Callout",
  maxLength: 80,
  repeating: true,
};
const CTA: CopyFieldDeclaration = {
  fieldId: "ctaHeadline",
  label: "Closing line",
  maxLength: 70,
};
const FIELDS = [HOOK, CALLOUT, CTA];

describe("emptyCopyState", () => {
  it("gives repeating fields one slot per item", () => {
    const s = emptyCopyState(FIELDS, 3);
    expect(s.featureCallout).toHaveLength(3);
    expect(s.hookHeadline).toHaveLength(1);
    expect(s.ctaHeadline).toHaveLength(1);
  });
});

describe("mergeSuggestions", () => {
  it("fills untouched fields with the draft", () => {
    const s = mergeSuggestions(
      emptyCopyState(FIELDS, 2),
      { ctaHeadline: "Stop guessing.", featureCallout: ["One", "Two"] },
      FIELDS,
    );
    expect(s.ctaHeadline[0].value).toBe("Stop guessing.");
    expect(s.featureCallout.map((f) => f.value)).toEqual(["One", "Two"]);
  });

  it("never overwrites what the operator typed", () => {
    // The rule the whole step hangs on. Losing wording someone liked is far
    // worse than showing them a stale draft.
    let s = emptyCopyState(FIELDS, 1);
    s = setFieldValue(s, "ctaHeadline", 0, "My own line");
    s = mergeSuggestions(s, { ctaHeadline: "A fresh draft" }, FIELDS);
    expect(s.ctaHeadline[0].value).toBe("My own line");
  });

  it("still collects new options for an edited field", () => {
    // Regenerating should widen the choices without destroying the text.
    let s = emptyCopyState(FIELDS, 1);
    s = setFieldValue(s, "hookHeadline", 0, "Mine");
    s = mergeSuggestions(s, { hookHeadline: ["A", "B", "C"] }, FIELDS);
    expect(s.hookHeadline[0].value).toBe("Mine");
    expect(s.hookHeadline[0].options).toEqual(["A", "B", "C"]);
  });

  it("treats a variants array as alternatives, not as per-item values", () => {
    // Same array shape as a repeating field, opposite meaning — getting this
    // backwards would scatter three hook options across three features.
    const s = mergeSuggestions(
      emptyCopyState(FIELDS, 3),
      { hookHeadline: ["A", "B", "C"] },
      FIELDS,
    );
    expect(s.hookHeadline).toHaveLength(1);
    expect(s.hookHeadline[0].value).toBe("A");
    expect(s.hookHeadline[0].options).toEqual(["A", "B", "C"]);
  });

  it("leaves fields the response omitted alone", () => {
    let s = emptyCopyState(FIELDS, 1);
    s = setFieldValue(s, "ctaHeadline", 0, "Kept");
    s = mergeSuggestions(s, { hookHeadline: ["X"] }, FIELDS);
    expect(s.ctaHeadline[0].value).toBe("Kept");
  });

  it("survives a degraded response of empty strings", () => {
    const s = mergeSuggestions(
      emptyCopyState(FIELDS, 2),
      { hookHeadline: ["", "", ""], featureCallout: ["", ""], ctaHeadline: "" },
      FIELDS,
    );
    expect(s.ctaHeadline[0].value).toBe("");
    expect(s.featureCallout).toHaveLength(2);
  });
});

describe("chooseVariant", () => {
  it("picks an option and protects it from later regeneration", () => {
    let s = mergeSuggestions(
      emptyCopyState(FIELDS, 1),
      { hookHeadline: ["A", "B", "C"] },
      FIELDS,
    );
    s = chooseVariant(s, "hookHeadline", "C");
    expect(s.hookHeadline[0].value).toBe("C");

    s = mergeSuggestions(s, { hookHeadline: ["X", "Y", "Z"] }, FIELDS);
    expect(s.hookHeadline[0].value).toBe("C");
  });
});

describe("resizeRepeating", () => {
  it("grows and shrinks with the feature count", () => {
    let s = emptyCopyState(FIELDS, 2);
    s = resizeRepeating(s, FIELDS, 4);
    expect(s.featureCallout).toHaveLength(4);
    s = resizeRepeating(s, FIELDS, 1);
    expect(s.featureCallout).toHaveLength(1);
  });

  it("keeps existing text when growing", () => {
    let s = emptyCopyState(FIELDS, 1);
    s = setFieldValue(s, "featureCallout", 0, "First");
    s = resizeRepeating(s, FIELDS, 3);
    expect(s.featureCallout[0].value).toBe("First");
    expect(s.featureCallout[2].value).toBe("");
  });

  it("leaves non-repeating fields untouched", () => {
    const s = resizeRepeating(emptyCopyState(FIELDS, 1), FIELDS, 5);
    expect(s.hookHeadline).toHaveLength(1);
  });
});

describe("toSubmission", () => {
  it("emits repeating fields as arrays and singles as strings", () => {
    let s = emptyCopyState(FIELDS, 2);
    s = setFieldValue(s, "featureCallout", 0, "One");
    s = setFieldValue(s, "featureCallout", 1, "Two");
    s = setFieldValue(s, "ctaHeadline", 0, "Close");
    const { copy } = toSubmission(s, FIELDS);
    expect(copy.featureCallout).toEqual(["One", "Two"]);
    expect(copy.ctaHeadline).toBe("Close");
  });

  it("records the hook that was chosen and the ones passed over", () => {
    // Kept so per-post metrics can later answer WHICH hooks perform, not
    // just that they differ. It cannot be reconstructed after the fact.
    let s = mergeSuggestions(
      emptyCopyState(FIELDS, 1),
      { hookHeadline: ["A", "B", "C"] },
      FIELDS,
    );
    s = chooseVariant(s, "hookHeadline", "B");
    const { hookVariants } = toSubmission(s, FIELDS);
    expect(hookVariants).toEqual({ chosen: "B", rejected: ["A", "C"] });
  });

  it("omits variant tracking when nothing was ever offered", () => {
    const { hookVariants } = toSubmission(emptyCopyState(FIELDS, 1), FIELDS);
    expect(hookVariants).toBeUndefined();
  });
});
