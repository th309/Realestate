import { describe, it, expect } from "vitest";
import {
  explorerReducer,
  initialExplorerState,
  resolveScope,
} from "../explorer-reducer";
import type { PathCrumb } from "../explorer-config";

const S = initialExplorerState;

describe("explorerReducer", () => {
  it("SET_VIEW map clears the path (map is national state view)", () => {
    const s = explorerReducer(
      { ...S, path: [{ level: "state", id: "48", name: "Texas" }] },
      { type: "SET_VIEW", view: "map" },
    );
    expect(s.view).toBe("map");
    expect(s.path).toEqual([]);
  });
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
