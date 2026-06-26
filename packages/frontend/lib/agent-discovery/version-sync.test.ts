import fs from "fs";
import path from "path";
import { describe, it, expect } from "vitest";
import { AGENT_DISCOVERY } from "./manifest";

// Drift guard (beta backlog #22): the public agent-discovery server-card
// (AGENT_DISCOVERY.mcp.version, served at /.well-known/mcp/server-card.json) and
// the MCP server's own SERVER_INFO.version are two independently-hardcoded
// constants in different packages. If one is bumped without the other, the
// www-served card silently reports a stale version. This test reads the
// mcp-server source and fails the build when the two diverge — bump both together.
function resolveServerInfoPath(): string {
  const candidates = [
    // vitest cwd = packages/frontend
    path.join(
      process.cwd(),
      "..",
      "mcp-server",
      "src",
      "lib",
      "server-info.ts",
    ),
    // Turbopack/workspace-root cwd
    path.join(
      process.cwd(),
      "packages",
      "mcp-server",
      "src",
      "lib",
      "server-info.ts",
    ),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return candidates[0];
}

describe("MCP version sync (server-card <-> mcp-server)", () => {
  it("manifest version matches mcp-server SERVER_INFO.version", () => {
    const source = fs.readFileSync(resolveServerInfoPath(), "utf-8");
    const match = source.match(/version:\s*["']([^"']+)["']/);
    expect(
      match,
      "could not find SERVER_INFO.version in mcp-server/src/lib/server-info.ts",
    ).toBeTruthy();
    expect(AGENT_DISCOVERY.mcp.version).toBe(match![1]);
  });
});
