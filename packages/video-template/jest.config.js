/** @type {import('jest').Config} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  testTimeout: 180_000, // bundle() + renderStill() can be slow
  testMatch: ["<rootDir>/tests/**/*.test.tsx", "<rootDir>/tests/**/*.test.ts"],
  // Remotion's bundler is heavy; don't try to mock it. Tests render real PNGs.
  moduleFileExtensions: ["ts", "tsx", "js", "json"],
  transform: {
    "^.+\\.(ts|tsx)$": [
      "ts-jest",
      { tsconfig: "<rootDir>/tsconfig.test.json" },
    ],
  },
};
