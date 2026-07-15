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
): LevelTab[] {
  const crumbAt = (lvl: string) => state.path.findIndex((c) => c.level === lvl);
  const tab = (
    label: string,
    level: "state" | "metro" | "county" | "zip",
  ): LevelTab => {
    if (level === "state")
      return {
        label,
        active: state.view === "map",
        enabled: true,
        onClick: () => dispatch({ type: "SET_VIEW", view: "map" }),
      };
    if (level === "metro")
      return {
        label,
        active: scopeGeoLevel === "metro" && state.view !== "map",
        enabled: true,
        onClick: () => {
          const i = crumbAt("state");
          if (i >= 0) dispatch({ type: "NAVIGATE_CRUMB", index: i });
          else dispatch({ type: "RESET_NATIONAL" });
        },
      };
    const parent = level === "county" ? "metro" : "county";
    const i = crumbAt(parent);
    return {
      label,
      active: scopeGeoLevel === level,
      enabled: i >= 0,
      onClick: () => i >= 0 && dispatch({ type: "NAVIGATE_CRUMB", index: i }),
    };
  };
  return [
    tab("State", "state"),
    tab("Metro", "metro"),
    tab("County", "county"),
    tab("ZIP", "zip"),
  ];
}
