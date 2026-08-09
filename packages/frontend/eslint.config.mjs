import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// M3 token names that exist ONLY under the `--md-*` (raw) and `--color-*`
// (Tailwind `@theme` alias) namespaces in app/globals.css — the bare name
// (e.g. `--primary`, `--outline-variant`) is never defined. `var()` fails
// silently, and for `stroke`/`border-color` the SVG/CSS fallback is `none`,
// so a chart painted with `var(--primary)` renders a correctly scaled axis
// frame with an invisible line. See lib/visualizations/chart-theme.ts for
// the real names and the incident this rule guards against.
// NOTE: `--background`/`--foreground` are deliberately excluded — those two
// ARE defined bare (legacy mapping in globals.css), unlike the rest of this list.
const UNDEFINED_BARE_M3_TOKENS = [
  "on-primary", "primary-container", "on-primary-container", "primary",
  "on-secondary", "secondary-container", "on-secondary-container", "secondary",
  "on-tertiary", "tertiary-text", "tertiary-container", "on-tertiary-container", "tertiary",
  "on-error", "error-container", "on-error-container", "error",
  "on-warning", "warning-container", "on-warning-container", "warning",
  "hero-from", "hero-to", "page-fade-from", "page-fade-mid", "page-fade-to",
  "accent-violet-container", "accent-violet", "accent-teal-container", "accent-teal",
  "surface-dim", "surface-bright",
  "surface-container-lowest", "surface-container-low", "surface-container-high",
  "surface-container-highest", "surface-container", "surface",
  "on-surface-variant", "on-surface",
  "outline-variant", "outline",
  "inverse-surface", "inverse-on-surface", "inverse-primary",
];
const BARE_TOKEN_PATTERN = UNDEFINED_BARE_M3_TOKENS.join("|");
// `(?![\\w-])` is the word-boundary substitute for the trailing `-` in names
// like `surface-container` — a real `\b` would also stop before a bare `-`.
const BARE_TOKEN_REGEX_SRC = `var\\(--(?:${BARE_TOKEN_PATTERN})(?![\\w-])`;
const bareTokenRule = {
  selector: `Literal[value=/${BARE_TOKEN_REGEX_SRC}/], TemplateElement[value.raw=/${BARE_TOKEN_REGEX_SRC}/]`,
  message:
    "Undefined CSS token: this --name has no bare definition, only --md-<name> and --color-<name> exist " +
    "(app/globals.css). var() fails silently, so stroke/border render as invisible `none`. " +
    "Use CHART_COLORS from @/lib/visualizations/chart-theme (charts) or the --color-<name> / bg-<name> / text-<name> Tailwind utility (everywhere else).",
};

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
  },
  // Catch undefined bare M3 CSS custom properties (see chart-theme.ts doc
  // comment for the DAU-chart incident this prevents).
  {
    rules: {
      "no-restricted-syntax": ["error", bareTokenRule],
    }
  }
]);

export default eslintConfig;
