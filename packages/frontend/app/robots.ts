import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  // /api/og is a public OG image generator referenced by every market page's
  // <meta property="og:image">. Crawlers must be able to fetch it for social
  // previews, so we explicitly allow it while keeping the rest of /api/ blocked.
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

  // AI-crawler stance (decision 2026-06-19): ALLOW EVERYTHING — both the
  // citation/search bots (which make PropertyIQ eligible to be *cited* in AI
  // answers) and the training bots (which ingest pages to *train* models).
  // Monthly-refreshed scores aren't worth withholding from training, and
  // robots.txt only binds bots that honor it; the win is max brand presence +
  // full AI-answer citability. Each bot is named EXPLICITLY so the policy is
  // deliberate and survives future edits to the `*` rule, rather than working
  // only by luck of the wildcard.
  const aiBots = [
    // Citation / search — eligibility to be cited in AI answers
    "OAI-SearchBot",
    "ChatGPT-User",
    "Claude-SearchBot",
    "Claude-User",
    "PerplexityBot",
    "Bingbot",
    // Training — welcomed (see note above)
    "GPTBot",
    "ClaudeBot",
    "Google-Extended",
  ];

  return {
    rules: [
      { userAgent: "*", allow, disallow },
      ...aiBots.map((userAgent) => ({ userAgent, allow, disallow })),
    ],
    sitemap: "https://www.propertyiq.app/sitemap.xml",
  };
}
