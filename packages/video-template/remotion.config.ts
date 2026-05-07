import { Config } from "@remotion/cli/config";
import { injectMapboxTokenWebpack } from "./src/webpack/inject-mapbox-token";

/**
 * Mapbox token is loaded in `inject-mapbox-token.ts` from monorepo / frontend
 * `.env` files when webpack bundles (avoids `setDotEnvLocation` resolving to a
 * bogus path under `node_modules/@remotion`).
 */
Config.overrideWebpackConfig(injectMapboxTokenWebpack);

Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);
Config.setConcurrency(4);
