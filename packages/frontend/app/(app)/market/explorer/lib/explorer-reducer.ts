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
  rootLevel: "metro",
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
  | { type: "RESET_NATIONAL"; level?: ExplorerGeoLevel };

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
    case "NAVIGATE_CRUMB": {
      const path = state.path.slice(0, action.index + 1);
      // Already exactly at this crumb (re-clicking the active tab/breadcrumb)
      // — a no-op, not a real navigation. Without this guard, clicking an
      // already-active level tab (e.g. Metro, drilled into a state, while
      // viewing its Map) silently forced view back to "bubbles" and cleared
      // the selection for no reason.
      if (path.length === state.path.length) return state;
      return {
        ...state,
        path,
        selectedId: null,
        view: "bubbles",
      };
    }
    case "RESET_NATIONAL":
      return {
        ...state,
        path: [],
        selectedId: null,
        view: action.level === "state" ? "map" : "bubbles",
        rootLevel: action.level ?? "metro",
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
  const last = state.path[state.path.length - 1];
  if (!last) return { geoLevel: state.rootLevel };
  return {
    geoLevel: childGeoLevel(last.level),
    parentLevel: last.level as "state" | "metro" | "county",
    parentId: last.id,
  };
}
