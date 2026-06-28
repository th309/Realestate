import { createHash } from "node:crypto";

import { AGENT_DISCOVERY } from "@/lib/agent-discovery/manifest";
import { AGENT_SKILLS } from "@/lib/agent-discovery/skills";

// /.well-known/agent-skills/index.json — Agent Skills Discovery RFC v0.2.0.
// Reachable via a next.config rewrite. Each `digest` is sha256 over the exact bytes
// served at the skill's `url` (see app/api/agent-discovery/agent-skill/[name]), so the
// index can never advertise a hash that disagrees with the served SKILL.md. The hash
// field is named `digest` (not `sha256`) and is formatted `sha256:<64 lowercase hex>`.
export async function GET(): Promise<Response> {
  const { siteOrigin } = AGENT_DISCOVERY;
  const doc = {
    $schema: "https://schemas.agentskills.io/discovery/0.2.0/schema.json",
    skills: AGENT_SKILLS.map((skill) => ({
      name: skill.name,
      type: "skill-md",
      description: skill.description,
      url: `${siteOrigin}/.well-known/agent-skills/${skill.name}/SKILL.md`,
      digest: `sha256:${createHash("sha256")
        .update(skill.markdown, "utf8")
        .digest("hex")}`,
    })),
  };
  return new Response(JSON.stringify(doc, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
