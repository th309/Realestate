import { describe, it, expect } from "vitest";
import { isAppChromeRoute } from "../app-routes";

describe("isAppChromeRoute", () => {
  it.each([
    "/dashboard",
    "/map",
    "/analyzer",
    "/screener",
    "/reports",
    "/market",
    "/account",
    "/admin",
    "/alerts",
    "/org",
    "/team",
  ])("gives %s the dark application chrome", (path) => {
    expect(isAppChromeRoute(path)).toBe(true);
  });

  it.each([
    "/map/",
    "/analyzer/results",
    "/reports/abc-123",
    "/market/14010",
    "/org/acme/admin",
    "/admin/users",
  ])("gives the nested route %s the dark chrome too", (path) => {
    expect(isAppChromeRoute(path)).toBe(true);
  });

  it.each(["/", "/blog", "/blog/some-post", "/about", "/pricing", "/help"])(
    "leaves the marketing route %s on the light header",
    (path) => {
      expect(isAppChromeRoute(path)).toBe(false);
    },
  );

  /**
   * `/markets` is the PUBLIC SEO route group, not the authed `/market` tool.
   * A bare `startsWith("/market")` would capture it and hand every indexed
   * market page the dark application bar, so matching is segment-bounded.
   */
  it.each(["/markets", "/markets/austin-tx", "/marketing"])(
    "does not let %s collide with the /market tool",
    (path) => {
      expect(isAppChromeRoute(path)).toBe(false);
    },
  );

  it("treats a null pathname as marketing", () => {
    expect(isAppChromeRoute(null)).toBe(false);
  });
});
