import { describe, it, expect } from "@jest/globals";
import path from "path";

/**
 * An `exports` map is a WHITELIST: the moment the package declares one, every
 * subpath not listed stops resolving.
 *
 * That is easy to get wrong here because the consumers are invisible from
 * inside this package — the backend renderer resolves
 * `dist/cli/render-cli.js` by path and spawns it, so dropping the wildcard
 * breaks every video render with an error that surfaces nowhere near this
 * file. These assertions exist so that failure shows up here instead.
 *
 * Requires a build (`npm run build:cli`).
 */
describe("package exports", () => {
  it.each([
    ["@propertyiq/video-template/dist/cli/render-cli.js", "video render"],
    [
      "@propertyiq/video-template/dist/cli/render-thumbnail-cli.js",
      "thumbnail render",
    ],
    ["@propertyiq/video-template/dist/cli/preflight-cli.js", "preflight"],
  ])("keeps %s resolvable (%s)", (specifier) => {
    expect(() => require.resolve(specifier)).not.toThrow();
  });

  it("exposes the format manifest on its own subpath", () => {
    const mod = require("@propertyiq/video-template/formats");
    expect(Object.keys(mod.FORMAT_MANIFEST).length).toBeGreaterThan(0);
    expect(typeof mod.compositionId).toBe("function");
  });

  it("keeps the manifest free of React and Remotion", () => {
    // The admin wizard imports this into a Next.js bundle. Pulling the
    // composition tree in would drag React, Remotion and Mapbox with it —
    // and the package root does exactly that, via registerRoot().
    const resolved = require.resolve("@propertyiq/video-template/formats");
    expect(resolved).toContain(path.join("dist", "formats"));

    const before = Object.keys(require.cache).length;
    require("@propertyiq/video-template/formats");
    void before;

    const loaded = Object.keys(require.cache);
    expect(
      loaded.some((f) => f.includes(`${path.sep}remotion${path.sep}`)),
    ).toBe(false);
  });
});
