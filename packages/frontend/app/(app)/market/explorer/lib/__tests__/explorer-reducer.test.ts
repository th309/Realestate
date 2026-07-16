import { describe, it, expect } from "vitest";
import {
  explorerReducer,
  initialExplorerState,
  resolveScope,
} from "../explorer-reducer";
import type { PathCrumb } from "../explorer-config";

const S = initialExplorerState;

describe("explorerReducer", () => {
  it("DRILL pushes a crumb, resets selection, forces bubbles", () => {
    const s = explorerReducer(
      { ...S, view: "map" },
      { type: "DRILL", crumb: { level: "state", id: "48", name: "Texas" } },
    );
    expect(s.path).toEqual([{ level: "state", id: "48", name: "Texas" }]);
    expect(s.selectedId).toBeNull();
    expect(s.view).toBe("bubbles");
  });
  it("NAVIGATE_CRUMB trims the path to the chosen index", () => {
    const path = [
      { level: "state", id: "48", name: "Texas" },
      { level: "metro", id: "19100", name: "Dallas" },
    ] as const;
    const s = explorerReducer(
      { ...S, path: [...path] },
      { type: "NAVIGATE_CRUMB", index: 0 },
    );
    expect(s.path).toHaveLength(1);
    expect(s.path[0].id).toBe("48");
  });
  it("PIN caps at 3 and dedupes; UNPIN removes", () => {
    let s = { ...S, pinnedIds: ["a", "b", "c"] };
    s = explorerReducer(s, { type: "PIN", id: "d" });
    expect(s.pinnedIds).toEqual(["a", "b", "c"]); // capped
    s = explorerReducer({ ...S, pinnedIds: ["a"] }, { type: "PIN", id: "a" });
    expect(s.pinnedIds).toEqual(["a"]); // dedupe
    s = explorerReducer(
      { ...S, pinnedIds: ["a", "b"] },
      { type: "UNPIN", id: "a" },
    );
    expect(s.pinnedIds).toEqual(["b"]);
  });
  it("TOGGLE_PLAY flips playing", () => {
    expect(explorerReducer(S, { type: "TOGGLE_PLAY" }).playing).toBe(true);
  });
});

describe("explorerReducer SET_VIEW", () => {
  it("switches view without resetting an active drill path", () => {
    const drilled = {
      ...initialExplorerState,
      path: [{ level: "state" as const, id: "48", name: "Texas", state: "TX" }],
      selectedId: "19100",
    };
    const result = explorerReducer(drilled, { type: "SET_VIEW", view: "map" });
    expect(result.view).toBe("map");
    expect(result.path).toEqual(drilled.path); // must NOT reset to []
    expect(result.selectedId).toBe("19100"); // must NOT clear selection
  });

  it("stops autoplay when switching view", () => {
    const playing = { ...initialExplorerState, playing: true };
    const result = explorerReducer(playing, { type: "SET_VIEW", view: "map" });
    expect(result.playing).toBe(false);
  });

  it("switching back to bubbles also preserves the path", () => {
    const drilled = {
      ...initialExplorerState,
      view: "map" as const,
      path: [
        { level: "metro" as const, id: "19100", name: "Dallas-Fort Worth" },
      ],
    };
    const result = explorerReducer(drilled, {
      type: "SET_VIEW",
      view: "bubbles",
    });
    expect(result.view).toBe("bubbles");
    expect(result.path).toEqual(drilled.path);
  });
});

describe("resolveScope", () => {
  it("national bubbles → metro; map → state; drilled metro → county", () => {
    expect(resolveScope(S).geoLevel).toBe("metro");
    expect(resolveScope({ ...S, view: "map" }).geoLevel).toBe("state");
    const drilled = {
      ...S,
      path: [{ level: "metro", id: "19100", name: "Dallas" }] as PathCrumb[],
    };
    expect(resolveScope(drilled)).toEqual({
      geoLevel: "county",
      parentLevel: "metro",
      parentId: "19100",
    });
  });
});
