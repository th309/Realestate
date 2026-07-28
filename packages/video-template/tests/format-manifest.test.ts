import { describe, it, expect } from "@jest/globals";
import {
  FORMAT_CONFIGS,
  FORMAT_KEYS,
  FORMAT_MANIFEST,
  compositionId,
} from "../src/formats/manifest";

/**
 * The manifest is read by three consumers that can't see each other: the
 * composition registry, the create-run contract, and the admin wizard. These
 * check the invariants each of them silently assumes.
 */
describe("format manifest", () => {
  it("keys its own entries consistently", () => {
    for (const key of FORMAT_KEYS) {
      expect(FORMAT_MANIFEST[key].key).toBe(key);
    }
  });

  it("derives render configs that match the manifest", () => {
    for (const key of FORMAT_KEYS) {
      const m = FORMAT_MANIFEST[key];
      const cfg = FORMAT_CONFIGS[key];
      expect(cfg.width).toBe(m.width);
      expect(cfg.height).toBe(m.height);
      expect(cfg.fps).toBe(m.fps);
      expect(cfg.durationInFrames).toBe(m.durationInFrames);
      expect(cfg.openWithBumper).toBe(m.openWithBumper);
    }
  });

  it("produces Remotion-legal composition ids", () => {
    for (const key of FORMAT_KEYS) {
      const id = compositionId(key);
      // Remotion ids can't contain underscores; the render CLI reconstructs
      // this id from the --format arg, so the mapping must stay total.
      expect(id).not.toContain("_");
      expect(id.replace(/-/g, "_")).toBe(key);
    }
  });

  it("only opens with a brand sting on horizontal long-form", () => {
    for (const key of FORMAT_KEYS) {
      const m = FORMAT_MANIFEST[key];
      if (m.openWithBumper) {
        // A logo before the first spoken word is a scroll-killer on
        // vertical short-form; it only reads as production value on 16:9.
        expect(m.width).toBeGreaterThan(m.height);
      }
    }
  });

  it("gives every format a duration a viewer would actually finish", () => {
    for (const key of FORMAT_KEYS) {
      const m = FORMAT_MANIFEST[key];
      expect(m.targetSeconds).toBeGreaterThan(0);
      // Vertical short-form lives or dies on completion rate.
      if (m.height > m.width) expect(m.targetSeconds).toBeLessThanOrEqual(90);
    }
  });

  it("ends every wizard flow in preview then confirm", () => {
    for (const key of FORMAT_KEYS) {
      const steps = FORMAT_MANIFEST[key].steps.map((s) => s.type);
      expect(steps.slice(-2)).toEqual(["preview", "confirm"]);
    }
  });

  it("asks for a market only when the format actually needs one", () => {
    for (const key of FORMAT_KEYS) {
      const m = FORMAT_MANIFEST[key];
      const asksForMarket = m.steps.some((s) => s.type === "market");
      expect(asksForMarket).toBe(m.dataSource === "single_market");
    }
  });

  it("declares unique slot ids within a format", () => {
    for (const key of FORMAT_KEYS) {
      const ids = FORMAT_MANIFEST[key].mediaSlots.map((s) => s.slotId);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it("keeps thumbnail copy short enough to read at thumb size", () => {
    for (const key of FORMAT_KEYS) {
      for (const field of FORMAT_MANIFEST[key].thumbnail.copyFields) {
        expect(field.maxLength).toBeLessThanOrEqual(40);
      }
    }
  });
});
