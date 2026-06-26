import fs from "fs";
import path from "path";

// Resolver/reader for the scoring methodology markdown (validation-report.md),
// shared by the methodology page AND the agent-markdown resolver so the
// dev-vs-standalone path logic lives in exactly one place.
//
// NOTE: the "(app)" route-group segment IS part of the on-disk path (it is only
// hidden from the URL). Omitting it makes both candidates miss → ENOENT.
export function resolveMethodologyReportPath(): string {
  const candidates = [
    // Co-located file (Docker/Vercel where docs/ isn't available)
    path.join(
      process.cwd(),
      "app",
      "(app)",
      "scores",
      "methodology",
      "validation-report.md",
    ),
    // Workspace root (Turbopack dev: cwd = workspace root)
    path.join(
      process.cwd(),
      "packages",
      "frontend",
      "app",
      "(app)",
      "scores",
      "methodology",
      "validation-report.md",
    ),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return candidates[0];
}

export function readMethodologyReport(): string {
  return fs.readFileSync(resolveMethodologyReportPath(), "utf-8");
}
