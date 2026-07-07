import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
    include: [
      "**/__tests__/**/*.{test,spec}.{ts,tsx}",
      // Source-adjacent unit tests (e.g. middleware.test.ts next to middleware.ts).
      "*.{test,spec}.{ts,tsx}",
      "app/**/*.{test,spec}.{ts,tsx}",
      "lib/**/*.{test,spec}.{ts,tsx}",
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["src/**/*.d.ts", "src/**/__tests__/**", "src/**/index.ts"],
    },
  },
  resolve: {
    // Route-group split: app/<folder> physically lives under app/(app)/ or
    // app/(public)/ now, but imports still use the original "@/app/<folder>"
    // specifier. Mirror the tsconfig "@/app/*" path mapping so the test runner
    // resolves them too. Order matters: specific entries before the "@" catch-all.
    alias: [
      ...[
        "about",
        "account",
        "activate",
        "admin",
        "alerts",
        "analyzer",
        "auth",
        "betatest",
        "blog",
        "contact",
        "dashboard",
        "data",
        "dev",
        "docs",
        "embed",
        "farm-area-audit",
        "grade-reveal-signup",
        "graphs",
        "help",
        "map",
        "market-comparison",
        "market",
        "metrics",
        "movers-report",
        "newsletter",
        "onboarding",
        "org",
        "pricing",
        "privacy",
        "reports",
        "s",
        "scores",
        "shared",
        "survey",
        "team",
        "terms",
        "top-cashflow-report",
        "tour",
        "upgrade",
      ].map((folder) => ({
        find: `@/app/${folder}`,
        replacement: path.resolve(__dirname, `app/(app)/${folder}`),
      })),
      {
        find: "@/app/markets",
        replacement: path.resolve(__dirname, "app/(public)/markets"),
      },
      {
        // Competitor-comparison SEO pages moved from (app) to (public).
        find: "@/app/compare",
        replacement: path.resolve(__dirname, "app/(public)/compare"),
      },
      { find: "@", replacement: path.resolve(__dirname, ".") },
    ],
  },
});
