import { findAgentSkill } from "@/lib/agent-discovery/skills";

// /.well-known/agent-skills/<name>/SKILL.md — the agent skill manifest, served
// verbatim. Reachable via a next.config rewrite. These exact bytes are what the
// agent-skills index hashes into each entry's `digest`, so this handler must return
// `skill.markdown` unmodified (no trimming, no re-encoding).
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ name: string }> },
): Promise<Response> {
  const { name } = await params;
  const skill = findAgentSkill(name);
  if (!skill) {
    return new Response("Not found\n", {
      status: 404,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
  return new Response(skill.markdown, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
