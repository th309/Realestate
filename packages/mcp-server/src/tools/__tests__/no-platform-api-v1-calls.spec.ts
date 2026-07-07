import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Regression guard: MCP tools must only call the PUBLIC `/api/*` backend
 * surface. The `/api/v1/*` Platform API is gated by `ApiKeyAuthGuard` and
 * demands `Authorization: Bearer piq_live_<key>`, which the MCP HTTP client
 * never sends (it only forwards `x-user-id`). Any tool pointed at `/api/v1/*`
 * therefore 401s — surfacing as a hard "token invalid" error, or (worse) a
 * silently-swallowed empty result when wrapped in `.catch()`.
 *
 * This exact bug shipped in `get_market_rankings`, `get_trending_markets`, and
 * `market_opportunity_alert`. This test keeps it from coming back.
 */
const toolsDir = join(__dirname, "..");

const toolFiles = readdirSync(toolsDir, { withFileTypes: true })
  .filter((entry) => entry.isFile() && entry.name.endsWith(".ts"))
  .map((entry) => entry.name);

describe("MCP tools stay on the public /api surface", () => {
  it("finds tool source files to scan", () => {
    expect(toolFiles.length).toBeGreaterThan(0);
  });

  it.each(toolFiles)(
    "%s makes no live fetchApi call to the api-key-gated /api/v1 surface",
    (file) => {
      const source = readFileSync(join(toolsDir, file), "utf8");
      // Match an actual fetchApi() call whose path targets /api/v1/* — the
      // char-class right after `fetchApi(` (optional whitespace, then a quote
      // or backtick) means explanatory comments mentioning /api/v1 don't trip
      // it, only real call sites do.
      const v1Call = /fetchApi\(\s*[`"'][^`"']*\/api\/v1\//.exec(source);
      expect(
        v1Call,
        `${file} calls the key-gated /api/v1 surface, which rejects the MCP's ` +
          `x-user-id-only auth (401). Use a public /api/* route instead.`,
      ).toBeNull();
    },
  );
});
