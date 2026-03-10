import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/admin/",
          "/dev/",
          "/auth/",
          "/account/",
          "/health/",
          "/betatest/",
        ],
      },
      {
        userAgent: "GPTBot",
        allow: "/",
        disallow: ["/api/", "/admin/", "/auth/", "/account/"],
      },
      {
        userAgent: "ClaudeBot",
        allow: "/",
        disallow: ["/api/", "/admin/", "/auth/", "/account/"],
      },
      {
        userAgent: "PerplexityBot",
        allow: "/",
        disallow: ["/api/", "/admin/", "/auth/", "/account/"],
      },
    ],
    sitemap: "https://www.propertyiq.app/sitemap.xml",
  };
}
