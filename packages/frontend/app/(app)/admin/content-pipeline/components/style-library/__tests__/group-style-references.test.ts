import { describe, it, expect } from "vitest";
import {
  groupStyleReferences,
  styleGroupName,
} from "../group-style-references";
import type { StyleReference } from "../../../lib/style-refs-api";

function ref(
  label: string,
  kind: string,
  created_at = "2026-07-28T00:00:00.000Z",
): StyleReference {
  return {
    id: `id-${label}-${kind}`,
    user_id: "user-1",
    kind,
    label,
    source_url: null,
    preview_strip_url: null,
    extracted_attributes: {},
    vision_cost_usd: 0,
    created_at,
  };
}

describe("styleGroupName derives the shared taxonomy key from a label", () => {
  it("strips the parenthetical from an image label", () => {
    expect(styleGroupName("Doom-Data Alarm (Graham Stephan thumbnail)")).toBe(
      "Doom-Data Alarm",
    );
  });

  it("strips the sample-video marker from a video label", () => {
    expect(
      styleGroupName("Doom-Data Alarm sample video (Graham Stephan housing)"),
    ).toBe("Doom-Data Alarm");
  });

  it("keeps a label without markers as its own group", () => {
    expect(styleGroupName("My custom look")).toBe("My custom look");
  });

  it("keeps a style genuinely named with the words sample video", () => {
    expect(styleGroupName("Sample Video Wall (showroom)")).toBe(
      "Sample Video Wall",
    );
  });

  it("falls back to Untitled for a whitespace-only label", () => {
    expect(styleGroupName("   ")).toBe("Untitled");
  });
});

describe("groupStyleReferences builds alphabetical style sections", () => {
  it("pairs an image and its sample video under one group, image first", () => {
    const groups = groupStyleReferences([
      ref("Doom-Data Alarm sample video (Graham)", "video"),
      ref("Bold-Type Hook (yellow blocks)", "thumbnail"),
      ref("Doom-Data Alarm (Graham thumbnail)", "thumbnail"),
    ]);
    expect(groups.map((g) => g.name)).toEqual([
      "Bold-Type Hook",
      "Doom-Data Alarm",
    ]);
    expect(groups[1].references.map((r) => r.kind)).toEqual([
      "thumbnail",
      "video",
    ]);
  });

  it("gives an unmatched label its own section", () => {
    const groups = groupStyleReferences([ref("One-off look", "thumbnail")]);
    expect(groups).toHaveLength(1);
    expect(groups[0].name).toBe("One-off look");
  });

  it("pairs labels that differ only by case under one group", () => {
    const groups = groupStyleReferences([
      ref("doom-data alarm sample video (Graham)", "video"),
      ref("Doom-Data Alarm (Graham thumbnail)", "thumbnail"),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].name).toBe("Doom-Data Alarm");
  });

  it("orders same-kind references newest first, matching the old flat grid", () => {
    const groups = groupStyleReferences([
      ref("Doom-Data Alarm (old)", "thumbnail", "2026-07-01T00:00:00.000Z"),
      ref("Doom-Data Alarm (new)", "thumbnail", "2026-07-28T00:00:00.000Z"),
    ]);
    expect(groups[0].references.map((r) => r.label)).toEqual([
      "Doom-Data Alarm (new)",
      "Doom-Data Alarm (old)",
    ]);
  });
});
