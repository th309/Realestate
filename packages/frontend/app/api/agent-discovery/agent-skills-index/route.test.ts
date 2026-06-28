import { createHash } from "node:crypto";

import { GET as getSkill } from "../agent-skill/[name]/route";
import { GET } from "./route";

describe("agent-skills index well-known route", () => {
  it("serves an Agent Skills Discovery RFC v0.2.0 index", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/json");
    const body = await res.json();
    expect(body.$schema).toBe(
      "https://schemas.agentskills.io/discovery/0.2.0/schema.json",
    );
    expect(Array.isArray(body.skills)).toBe(true);
    expect(body.skills.length).toBeGreaterThanOrEqual(2);
    for (const skill of body.skills) {
      expect(typeof skill.name).toBe("string");
      expect(skill.name).toMatch(/^[a-z0-9-]+$/);
      expect(skill.type).toBe("skill-md");
      expect(typeof skill.description).toBe("string");
      expect(skill.url).toMatch(
        /^https:\/\/www\.propertyiq\.app\/\.well-known\/agent-skills\/[a-z0-9-]+\/SKILL\.md$/,
      );
      expect(skill.digest).toMatch(/^sha256:[0-9a-f]{64}$/);
    }
  });

  it("publishes a digest that matches the exact bytes served at each skill url", async () => {
    const body = await (await GET()).json();
    for (const entry of body.skills) {
      const served = await getSkill(new Request("https://www.propertyiq.app"), {
        params: Promise.resolve({ name: entry.name }),
      });
      expect(served.status).toBe(200);
      const bytes = await served.text();
      const digest = `sha256:${createHash("sha256")
        .update(bytes, "utf8")
        .digest("hex")}`;
      expect(entry.digest).toBe(digest);
    }
  });
});
