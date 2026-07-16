import { describe, it, expect, vi } from "vitest";
import { buildLevelTabs, buildBreadcrumbs } from "../explorer-navigation";
import { initialExplorerState } from "../explorer-reducer";
import type {
  ExplorerGeoLevel,
  ExplorerState,
  PathCrumb,
} from "../explorer-config";

const S = initialExplorerState;

function metroTab(
  state: ExplorerState,
  scopeGeoLevel: ExplorerGeoLevel = "metro",
) {
  const dispatch = vi.fn();
  const tabs = buildLevelTabs(state, scopeGeoLevel, dispatch, null);
  const tab = tabs.find((t) => t.label === "Metro")!;
  return { tab, dispatch };
}

describe("buildLevelTabs — Metro tab", () => {
  it("is a no-op when already at metro root in Bubbles view", () => {
    const { tab, dispatch } = metroTab({
      ...S,
      rootLevel: "metro",
      view: "bubbles",
    });
    expect(tab.active).toBe(true);
    tab.onClick();
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("is a no-op when already at metro root in Map view — must NOT silently force Map back to Bubbles", () => {
    // Regression: before the fix, clicking the already-active Metro tab
    // while viewing the national metro map dispatched RESET_NATIONAL (no
    // level), which forces view back to "bubbles" for no reason.
    const { tab, dispatch } = metroTab({
      ...S,
      rootLevel: "metro",
      view: "map",
    });
    expect(tab.active).toBe(true);
    tab.onClick();
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("resets to metro root when switching away from the State tab/map", () => {
    const { tab, dispatch } = metroTab(
      { ...S, rootLevel: "state", view: "map" },
      "state",
    );
    expect(tab.active).toBe(false); // scopeGeoLevel is "state", not "metro"
    tab.onClick();
    expect(dispatch).toHaveBeenCalledWith({ type: "RESET_NATIONAL" });
  });

  it("navigates back to the state crumb when drilled below it", () => {
    const path: PathCrumb[] = [{ level: "state", id: "48", name: "Texas" }];
    const { tab, dispatch } = metroTab({ ...S, path, rootLevel: "metro" });
    tab.onClick();
    expect(dispatch).toHaveBeenCalledWith({
      type: "NAVIGATE_CRUMB",
      index: 0,
    });
  });
});

describe("buildLevelTabs — County tab", () => {
  it("is disabled at the national metro-root view (nothing to drill into yet)", () => {
    const dispatch = vi.fn();
    const tabs = buildLevelTabs(
      { ...S, rootLevel: "metro" },
      "metro",
      dispatch,
      null,
    );
    const county = tabs.find((t) => t.label === "County")!;
    expect(county.enabled).toBe(false);
  });

  it("is enabled at the metro-root view via onDrillSelected, without needing an existing metro crumb", () => {
    const onDrillSelected = vi.fn();
    const dispatch = vi.fn();
    const tabs = buildLevelTabs(
      { ...S, rootLevel: "metro" },
      "metro",
      dispatch,
      onDrillSelected,
    );
    const county = tabs.find((t) => t.label === "County")!;
    expect(county.enabled).toBe(true);
    county.onClick();
    expect(onDrillSelected).toHaveBeenCalled();
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("navigates back to the existing metro crumb instead of re-drilling, once one exists", () => {
    const path: PathCrumb[] = [
      { level: "metro", id: "35620", name: "New York", state: "NY" },
    ];
    const onDrillSelected = vi.fn();
    const dispatch = vi.fn();
    const tabs = buildLevelTabs(
      { ...S, path },
      "county",
      dispatch,
      onDrillSelected,
    );
    const county = tabs.find((t) => t.label === "County")!;
    expect(county.enabled).toBe(true);
    county.onClick();
    expect(dispatch).toHaveBeenCalledWith({ type: "NAVIGATE_CRUMB", index: 0 });
    expect(onDrillSelected).not.toHaveBeenCalled();
  });
});

describe("buildLevelTabs — ZIP tab", () => {
  it("is disabled at metro root (nothing to drill into yet)", () => {
    const dispatch = vi.fn();
    const tabs = buildLevelTabs(
      { ...S, rootLevel: "metro" },
      "metro",
      dispatch,
      null,
    );
    const zip = tabs.find((t) => t.label === "ZIP")!;
    expect(zip.enabled).toBe(false);
  });

  it("is enabled at a metro's county view via onDrillSelected, without needing an existing county crumb", () => {
    const path: PathCrumb[] = [
      { level: "metro", id: "35620", name: "New York", state: "NY" },
    ];
    const onDrillSelected = vi.fn();
    const dispatch = vi.fn();
    const tabs = buildLevelTabs(
      { ...S, path },
      "county",
      dispatch,
      onDrillSelected,
    );
    const zip = tabs.find((t) => t.label === "ZIP")!;
    expect(zip.enabled).toBe(true);
    zip.onClick();
    expect(onDrillSelected).toHaveBeenCalled();
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("navigates back to the existing county crumb instead of re-drilling, once one exists", () => {
    const path: PathCrumb[] = [
      { level: "metro", id: "35620", name: "New York", state: "NY" },
      { level: "county", id: "36061", name: "New York County", state: "NY" },
    ];
    const onDrillSelected = vi.fn();
    const dispatch = vi.fn();
    const tabs = buildLevelTabs(
      { ...S, path },
      "zip",
      dispatch,
      onDrillSelected,
    );
    const zip = tabs.find((t) => t.label === "ZIP")!;
    expect(zip.enabled).toBe(true);
    zip.onClick();
    expect(dispatch).toHaveBeenCalledWith({
      type: "NAVIGATE_CRUMB",
      index: 1,
    });
    expect(onDrillSelected).not.toHaveBeenCalled();
  });
});

describe("buildBreadcrumbs", () => {
  it("marks United States active only at the national root", () => {
    const dispatch = vi.fn();
    expect(buildBreadcrumbs(S, dispatch)[0].active).toBe(true);
    const path: PathCrumb[] = [{ level: "metro", id: "35620", name: "NYC" }];
    expect(buildBreadcrumbs({ ...S, path }, dispatch)[0].active).toBe(false);
  });
});
