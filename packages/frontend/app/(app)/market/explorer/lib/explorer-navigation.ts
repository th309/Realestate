import { titleCaseLocationName } from "@/lib/data";
import type { ExplorerAction } from "./explorer-reducer";
import type { ExplorerGeoLevel, ExplorerState } from "./explorer-config";

export interface Crumb {
  label: string;
  active: boolean;
  onClick: () => void;
}
export interface LevelTab {
  label: string;
  enabled: boolean;
  active: boolean;
  onClick: () => void;
}

type Dispatch = (action: ExplorerAction) => void;

export function buildBreadcrumbs(
  state: ExplorerState,
  dispatch: Dispatch,
): Crumb[] {
  return [
    {
      label: "United States",
      active: state.path.length === 0,
      onClick: () => dispatch({ type: "RESET_NATIONAL" }),
    },
    ...state.path.map((c, i) => ({
      label: titleCaseLocationName(c.name),
      active: i === state.path.length - 1,
      onClick: () => dispatch({ type: "NAVIGATE_CRUMB", index: i }),
    })),
  ];
}

export function buildLevelTabs(
  state: ExplorerState,
  scopeGeoLevel: ExplorerGeoLevel,
  dispatch: Dispatch,
  /** Drills into the currently selected entity (same DRILL path a map/bubble
   * double-click uses). Null when there's nothing selected to drill into. */
  onDrillSelected: (() => void) | null,
): LevelTab[] {
  const crumbAt = (lvl: string) => state.path.findIndex((c) => c.level === lvl);
  const tab = (
    label: string,
    level: "state" | "metro" | "county" | "zip",
  ): LevelTab => {
    if (level === "state")
      return {
        label,
        active: state.path.length === 0 && state.rootLevel === "state",
        enabled: true,
        onClick: () => dispatch({ type: "RESET_NATIONAL", level: "state" }),
      };
    if (level === "metro")
      return {
        label,
        active: scopeGeoLevel === "metro",
        enabled: true,
        onClick: () => {
          const i = crumbAt("state");
          if (i >= 0) dispatch({ type: "NAVIGATE_CRUMB", index: i });
          // Already at metro root (bubbles or map) — clicking the
          // already-active tab must be a no-op, not silently force Map back
          // to Bubbles. Only actually switching root levels (from State)
          // needs the reset.
          else if (state.rootLevel !== "metro")
            dispatch({ type: "RESET_NATIONAL" });
        },
      };
    // "county" and "zip" share the same pattern: once the parent tier's
    // crumb already exists, jump back to it. Otherwise — viewing the parent
    // tier's list with one entity auto-selected — jump straight into that
    // selection's children instead of forcing an extra "double-click to
    // drill in first" step (County needs a metro crumb, ZIP needs a county
    // crumb).
    const parentLevel = level === "county" ? "metro" : "county";
    const i = crumbAt(parentLevel);
    if (i >= 0)
      return {
        label,
        active: scopeGeoLevel === level,
        enabled: true,
        onClick: () => dispatch({ type: "NAVIGATE_CRUMB", index: i }),
      };
    return {
      label,
      active: false,
      enabled: scopeGeoLevel === parentLevel && !!onDrillSelected,
      onClick: () => onDrillSelected?.(),
    };
  };
  return [
    tab("State", "state"),
    tab("Metro", "metro"),
    tab("County", "county"),
    tab("ZIP", "zip"),
  ];
}
