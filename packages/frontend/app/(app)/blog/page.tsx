import type { Metadata } from "next";
import { BookOpen } from "lucide-react";
import { getAllPosts } from "@/lib/blog";
import { PageHeaderWithBreadcrumbs } from "@/components/navigation";
import { BlogIndexContent } from "./BlogIndexContent";

export const metadata: Metadata = {
  title: "Blog",
  description:
    "Data-driven housing market analysis, forecasts, and investment insights from PropertyIQ Research.",
  alternates: { canonical: "https://www.propertyiq.app/blog" },
  openGraph: {
    title: "PropertyIQ Blog",
    description:
      "Data-driven housing market analysis, forecasts, and investment insights.",
    url: "https://www.propertyiq.app/blog",
    siteName: "PropertyIQ",
    type: "website",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "PropertyIQ Blog",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "PropertyIQ Blog",
    description:
      "Data-driven housing market analysis, forecasts, and investment insights.",
    images: ["/twitter-image.png"],
  },
};

export default function BlogIndexPage() {
  const posts = getAllPosts();

  // Strip content field to avoid serializing full markdown to the client
  const postSummaries = posts.map(({ slug, frontmatter, readingTime }) => ({
    slug,
    frontmatter: {
      title: frontmatter.title,
      description: frontmatter.description,
      date: frontmatter.date,
      category: frontmatter.category,
      tags: frontmatter.tags,
    },
    readingTime,
  }));

  const blogJsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        name: "PropertyIQ Blog",
        description:
          "Data-driven housing market analysis, forecasts, and investment insights.",
        url: "https://www.propertyiq.app/blog",
        isPartOf: { "@id": "https://www.propertyiq.app/#website" },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "Home",
            item: "https://www.propertyiq.app",
          },
          {
            "@type": "ListItem",
            position: 2,
            name: "Blog",
            item: "https://www.propertyiq.app/blog",
          },
        ],
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(blogJsonLd) }}
      />
      <div className="min-h-screen">
        <PageHeaderWithBreadcrumbs
          breadcrumbs={[{ label: "Blog" }]}
          title="PropertyIQ Blog"
          description="Data-driven housing market analysis, forecasts, and investment insights."
          icon={<BookOpen className="w-5 h-5" />}
        />

        <BlogIndexContent posts={postSummaries} />
      </div>
    </>
  );
}
