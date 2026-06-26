/**
 * Jest config for the top-level `scripts/` package.
 * Used by Phase 1+ ingest tests (e.g. QCEW sector parser).
 */
const path = require("path");

module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  rootDir: __dirname,
  roots: ["<rootDir>"],
  testMatch: ["**/__tests__/**/*.spec.ts", "**/*.test.ts"],
  testPathIgnorePatterns: ["/node_modules/"],
};
