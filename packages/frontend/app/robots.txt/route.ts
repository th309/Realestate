// robots.txt emitted as a text route handler (not Next's MetadataRoute) so it can
// include a Content-Signal directive, which the metadata API can't express.
//
// AI policy (decoupled access vs. usage license): crawl ACCESS is granted to every
// bot — including the training crawlers — for max search + AI-citation reach, while
// the Content-Signal withholds a training LICENSE (ai-train=no). Bots that honor
// Content Signals refrain from training; the rest are bound only by directives they
// already ignore. (Supersedes the 2026-06-19 "training welcomed" rationale; the
// access list is unchanged.)
const allow = ["/", "/api/og"];
const disallow = [
  "/api/",
  "/admin/",
  "/auth/",
  "/account/",
  "/dev/",
  "/health/",
  "/betatest/",
];
const aiBots = [
  // Citation / search — eligibility to be cited in AI answers
  "OAI-SearchBot",
  "ChatGPT-User",
  "Claude-SearchBot",
  "Claude-User",
  "PerplexityBot",
  "Bingbot",
  // Training — crawl allowed; training license withheld via Content-Signal
  "GPTBot",
  "ClaudeBot",
  "Google-Extended",
  "CCBot",
  "anthropic-ai",
  "Bytespider",
  "cohere-ai",
];
const SITEMAP = "https://www.propertyiq.app/sitemap.xml";
const CONTENT_SIGNAL = "search=yes, ai-input=yes, ai-train=no";

function group(userAgent: string, withSignal: boolean): string {
  const lines = [`User-agent: ${userAgent}`];
  for (const path of allow) lines.push(`Allow: ${path}`);
  for (const path of disallow) lines.push(`Disallow: ${path}`);
  if (withSignal) lines.push(`Content-Signal: ${CONTENT_SIGNAL}`);
  return lines.join("\n");
}

export async function GET(): Promise<Response> {
  const groups = [group("*", true), ...aiBots.map((bot) => group(bot, false))];
  const body = `${groups.join("\n\n")}\n\nSitemap: ${SITEMAP}\n`;
  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
