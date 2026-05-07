/** @type {import('jest').Config} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  testTimeout: 180_000, // bundle() + renderStill() can be slow
  testMatch: ["<rootDir>/tests/**/*.test.tsx", "<rootDir>/tests/**/*.test.ts"],
  // Remotion's bundler is heavy; don't try to mock it. Tests render real PNGs.
  moduleFileExtensions: ["ts", "tsx", "js", "json"],
  // Serialize test files. Each suite spins up Remotion's headless server +
  // Chrome on a fixed port (3002 by default); running suites in parallel
  // workers races for the port and produces EADDRINUSE.
  maxWorkers: 1,
  transform: {
    "^.+\\.(ts|tsx)$": [
      "ts-jest",
      { tsconfig: "<rootDir>/tsconfig.test.json" },
    ],
  },
  moduleNameMapper: {
    "\\.css$": "<rootDir>/tests/css-mock.js",
  },
};
