import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
// Importing the module runs the pre-hydration registration (the module-level
// `if (typeof window !== "undefined")` guard in WebMcpProvider), so the tools are
// registered on navigator.modelContext BEFORE any component mounts — this is what a
// readiness scanner snapshots on page load.
import WebMcpProvider from "./WebMcpProvider";

interface RegisteredTool {
  name: string;
  description: string;
  inputSchema?: unknown;
  execute: (input: Record<string, unknown>) => Promise<unknown>;
}

function modelContext():
  | { tools?: RegisteredTool[]; __propertyiqRegistered?: boolean }
  | undefined {
  return (
    navigator as unknown as {
      modelContext?: {
        tools?: RegisteredTool[];
        __propertyiqRegistered?: boolean;
      };
    }
  ).modelContext;
}

describe("WebMcpProvider WebMCP registration", () => {
  it("registers PropertyIQ tools on navigator.modelContext.tools at module load", () => {
    const mc = modelContext();
    expect(mc).toBeDefined();
    expect(Array.isArray(mc!.tools)).toBe(true);
    const names = mc!.tools!.map((tool) => tool.name).sort();
    expect(names).toEqual([
      "get_market_snapshot",
      "get_propertyiq_score",
      "search_markets",
    ]);
  });

  it("exposes each tool with the WebMCP shape (description, inputSchema, execute)", () => {
    for (const tool of modelContext()!.tools!) {
      expect(typeof tool.name).toBe("string");
      expect(typeof tool.description).toBe("string");
      expect(typeof tool.inputSchema).toBe("object");
      expect(typeof tool.execute).toBe("function");
    }
  });

  it("is idempotent — the mount effect does not double-register tools", () => {
    const before = modelContext()!.tools!.length;
    expect(before).toBe(3);
    render(<WebMcpProvider />);
    const mc = modelContext()!;
    expect(mc.__propertyiqRegistered).toBe(true);
    expect(mc.tools!.length).toBe(before);
  });
});
