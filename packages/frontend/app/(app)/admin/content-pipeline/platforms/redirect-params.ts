/**
 * Single source of truth for the query-param names used by the TWO OAuth return
 * flows that both land on /admin/content-pipeline/platforms:
 *   - YouTube direct OAuth (page.tsx) → `connected` / `error` / `label`
 *   - Late one-click connect (the wall) → `late_connected`
 *
 * Both effects call router.replace on the same path, so their params MUST NOT
 * collide and only one may own the URL cleanup on a shared return. The backend
 * redirect builders (social-connect-redirect.ts, and the direct-OAuth callback
 * controller) point here so the names stay coordinated, not accidentally unique.
 */
export const CONNECTED_PARAM = "connected";
export const CONNECT_ERROR_PARAM = "error";
export const CONNECT_LABEL_PARAM = "label";

/** Late one-click return marker (see social-connect-redirect.ts). */
export const LATE_CONNECTED_PARAM = "late_connected";

/** Params owned by the YouTube direct-OAuth callback bridge in page.tsx. */
export const YOUTUBE_BRIDGE_PARAMS = [
  CONNECTED_PARAM,
  CONNECT_ERROR_PARAM,
] as const;
