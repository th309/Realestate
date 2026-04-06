import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  // /api/og is a public OG image generator referenced by every market page's
  // <meta property="og:image">. Crawlers must be able to fetch it for social
  // previews, so we explicitly allow it while keeping the rest of /api/ blocked.
  const commonAllow = ["/", "/api/og"];
  const commonDisallow = ["/api/", "/admin/", "/auth/", "/account/"];

  return {
    rules: [
      {
        userAgent: "*",
        allow: commonAllow,
        disallow: [...commonDisallow, "/dev/", "/health/", "/betatest/"],
      },
      {
        userAgent: "GPTBot",
        allow: commonAllow,
        disallow: commonDisallow,
      },
      {
        userAgent: "ClaudeBot",
        allow: commonAllow,
        disallow: commonDisallow,
      },
      {
        userAgent: "PerplexityBot",
        allow: commonAllow,
        disallow: commonDisallow,
      },
    ],
    sitemap: "https://www.propertyiq.app/sitemap.xml",
  };
}
