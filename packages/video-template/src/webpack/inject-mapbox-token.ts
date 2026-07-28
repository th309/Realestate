import fs from "fs";
import path from "path";
import { config as loadEnvFile } from "dotenv";
/**
 * Webpack comes from @remotion/bundler, NOT the root install.
 *
 * The monorepo has two webpack copies (Next.js hoists one to the root;
 * @remotion/bundler nests its own), and their Configuration types are
 * structurally identical but nominally distinct. Importing from "webpack"
 * directly makes this override unassignable to bundle()'s webpackOverride,
 * which TypeScript reports as a confusing overload mismatch on bundle()
 * itself rather than on the callback.
 */
import {
  webpack,
  type WebpackConfiguration,
  type WebpackOverrideFn,
} from "@remotion/bundler";

/**
 * Repo root `.env` is often absent in dev; Next.js loads `packages/frontend/.env.local`.
 * Use `process.cwd()` (Remotion runs from `packages/video-template`) — `__dirname`
 * here can be wrong when webpack invokes this hook.
 */
function loadMapboxEnvFiles(): void {
  const cwd = process.cwd();
  /** Load frontend `.env.local` before repo `.env` — dotenv does not override existing keys, and root `.env` often carries placeholder Mapbox values. */
  const candidates = [
    path.join(cwd, "..", "frontend", ".env.local"),
    path.join(cwd, "..", "frontend", ".env"),
    path.join(cwd, ".env"),
    path.join(cwd, "..", "..", ".env"),
  ];
  for (const file of candidates) {
    if (fs.existsSync(file)) {
      loadEnvFile({ path: file });
    }
  }
}

/**
 * Remotion’s client bundle does not see env at runtime; we inline one key for Mapbox.
 */
function resolveMapboxTokenForClientBundle(): string {
  return (
    process.env.REMOTION_MAPBOX_TOKEN?.trim() ||
    process.env.NEXT_PUBLIC_MAPBOX_TOKEN?.trim() ||
    process.env.MAPBOX_ACCESS_TOKEN?.trim() ||
    ""
  );
}

export const injectMapboxTokenWebpack: WebpackOverrideFn = (
  config: WebpackConfiguration,
): WebpackConfiguration => {
  loadMapboxEnvFiles();
  const token = resolveMapboxTokenForClientBundle();
  if (token.length === 0) {
    // eslint-disable-next-line no-console
    console.warn(
      "[@propertyiq/video-template] Mapbox: no token after loading .env files (checked REMOTION_MAPBOX_TOKEN, NEXT_PUBLIC_MAPBOX_TOKEN, MAPBOX_ACCESS_TOKEN). Add NEXT_PUBLIC_MAPBOX_TOKEN to packages/frontend/.env.local or Remotion will show Intro instead of the map.",
    );
  }
  return {
    ...config,
    plugins: [
      ...(config.plugins ?? []),
      new webpack.DefinePlugin({
        "process.env.REMOTION_MAPBOX_TOKEN": JSON.stringify(token),
      }),
    ],
  };
};
