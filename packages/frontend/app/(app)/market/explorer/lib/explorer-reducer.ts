import {
  childGeoLevel,
  type ExplorerGeoLevel,
  type ExplorerMetricId,
  type ExplorerState,
  type PathCrumb,
  type RangePreset,
  type ViewMode,
} from "./explorer-config";

export const initialExplorerState: ExplorerState = {
  path: [],
  selectedId: null,
  pinnedIds: [],
  metric: "score",
  monthIndex: 0,
  view: "bubbles",
  range: 24,
  playing: false,
  includeNearby: false,
};

export type ExplorerAction =
  | { type: "SET_METRIC"; metric: ExplorerMetricId }
  | { type: "SET_MONTH"; monthIndex: number }
  | { type: "SET_RANGE"; range: RangePreset }
  | { type: "SET_VIEW"; view: ViewMode }
  | { type: "SELECT"; id: string }
  | { type: "PIN"; id: string }
  | { type: "UNPIN"; id: string }
  | { type: "CLEAR_PINS" }
  | { type: "TOGGLE_PLAY" }
  | { type: "SET_PLAYING"; playing: boolean }
  | { type: "TOGGLE_NEARBY" }
  | { type: "DRILL"; crumb: PathCrumb }
  | { type: "NAVIGATE_CRUMB"; index: number }
  | { type: "RESET_NATIONAL" };

export function explorerReducer(
  state: ExplorerState,
  action: ExplorerAction,
): ExplorerState {
  switch (action.type) {
    case "SET_METRIC":
      return { ...state, metric: action.metric };
    // SET_MONTH does NOT pause — autoplay advances via SET_MONTH each tick.
    // A manual drag additionally dispatches SET_PLAYING:false (see Task 26 wiring).
    case "SET_MONTH":
      return { ...state, monthIndex: action.monthIndex };
    case "SET_RANGE":
      return { ...state, range: action.range };
    case "SET_VIEW":
      return { ...state, view: action.view, playing: false };
    case "SELECT":
      return { ...state, selectedId: action.id };
    case "PIN":
      if (state.pinnedIds.includes(action.id) || state.pinnedIds.length >= 3)
        return state;
      return { ...state, pinnedIds: [...state.pinnedIds, action.id] };
    case "UNPIN":
      return {
        ...state,
        pinnedIds: state.pinnedIds.filter((p) => p !== action.id),
      };
    case "CLEAR_PINS":
      return { ...state, pinnedIds: [] };
    case "TOGGLE_PLAY":
      return { ...state, playing: !state.playing };
    case "SET_PLAYING":
      return { ...state, playing: action.playing };
    case "TOGGLE_NEARBY":
      return { ...state, includeNearby: !state.includeNearby };
    case "DRILL":
      return {
        ...state,
        path: [...state.path, action.crumb],
        selectedId: null,
        view: "bubbles",
        playing: false,
      };
    case "NAVIGATE_CRUMB":
      return {
        ...state,
        path: state.path.slice(0, action.index + 1),
        selectedId: null,
        view: "bubbles",
      };
    case "RESET_NATIONAL":
      return {
        ...state,
        path: [],
        selectedId: null,
        view: "bubbles",
        includeNearby: false,
      };
    default:
      return state;
  }
}

/** Effective backend scope for the current UI state. */
export function resolveScope(state: ExplorerState): {
  geoLevel: ExplorerGeoLevel;
  parentLevel?: "state" | "metro" | "county";
  parentId?: string;
} {
  if (state.view === "map" && state.path.length === 0)
    return { geoLevel: "state" };
  const last = state.path[state.path.length - 1];
  if (!last) return { geoLevel: "metro" };
  return {
    geoLevel: childGeoLevel(last.level),
    parentLevel: last.level as "state" | "metro" | "county",
    parentId: last.id,
  };
}
