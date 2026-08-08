import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    // Every parallel dist dir, matching the `/.next-*/` convention .gitignore
    // documents (.next-dev, .next-verify, .next-test, .next-mobile). Listing
    // only .next-dev meant a production build into .next-verify — which the
    // redesign plan's own verification step prescribes — put ~1,280 generated
    // files into the lint run and reported ~89,000 phantom problems.
    ".next-*/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  // Enforce data layer usage
  {
    rules: {
      "no-restricted-imports": ["error", {
        "patterns": [{
          "group": ["**/lib/api/client*"],
          "message": "Use @/lib/data instead. lib/api/client is deprecated."
        }]
      }]
    }
  }
]);

export default eslintConfig;
