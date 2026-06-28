import { GET } from "./route";

describe("a2a-agent-card well-known route", () => {
  it("serves an A2A Agent Card with the fields the isitagentready check validates", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/json");
    const body = await res.json();

    // Top-level identity (name, version, description).
    expect(body.name).toBe("PropertyIQ");
    expect(typeof body.description).toBe("string");
    expect(body.description.length).toBeGreaterThan(0);
    expect(typeof body.version).toBe("string");

    // supportedInterfaces with a service URL + transport binding (A2A schema).
    expect(Array.isArray(body.supportedInterfaces)).toBe(true);
    expect(body.supportedInterfaces[0].url).toBe(
      "https://mcp.propertyiq.app/mcp",
    );
    expect(body.supportedInterfaces[0].protocolBinding).toBe("JSONRPC");

    expect(typeof body.capabilities).toBe("object");

    // Each skill carries id, name, description.
    expect(body.skills.length).toBeGreaterThanOrEqual(1);
    for (const skill of body.skills) {
      expect(typeof skill.id).toBe("string");
      expect(typeof skill.name).toBe("string");
      expect(typeof skill.description).toBe("string");
    }
  });
});
