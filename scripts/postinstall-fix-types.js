/**
 * Postinstall script: fix broken @types/mapbox__point-geometry
 *
 * The package is a deprecated stub with no index.d.ts (since @mapbox/point-geometry
 * ships its own types). But mapbox-gl depends on it transitively, and TypeScript's
 * type resolution fails with TS2688. This copies our local stub into the right place.
 */
const fs = require("fs");
const path = require("path");

const src = path.join(
  __dirname,
  "..",
  "packages",
  "frontend",
  "types",
  "mapbox__point-geometry",
  "index.d.ts",
);
const dest = path.join(
  __dirname,
  "..",
  "node_modules",
  "@types",
  "mapbox__point-geometry",
  "index.d.ts",
);

if (fs.existsSync(src) && fs.existsSync(path.dirname(dest))) {
  fs.copyFileSync(src, dest);
  console.log(
    "postinstall: patched @types/mapbox__point-geometry with stub index.d.ts",
  );
}
