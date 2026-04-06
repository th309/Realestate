import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getPostBySlug, getAllSlugs } from "@/lib/blog";
import { BlogPostContent } from "./BlogPostContent";
import { RelatedPosts } from "./RelatedPosts";

interface BlogPostPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  const slugs = getAllSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: BlogPostPageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = getPostBySlug(slug);

  if (!post) {
    return { title: "Post Not Found" };
  }

  const { frontmatter } = post;

  const allKeywords = [
    ...(frontmatter.targetKeyword ? [frontmatter.targetKeyword] : []),
    ...(frontmatter.keywords ?? []),
  ];

  return {
    title: frontmatter.title,
    description: frontmatter.description,
    authors: [{ name: frontmatter.author }],
    ...(allKeywords.length > 0 && { keywords: allKeywords }),
    alternates: { canonical: `https://www.propertyiq.app/blog/${slug}` },
    openGraph: {
      type: "article",
      title: frontmatter.title,
      description: frontmatter.description,
      publishedTime: frontmatter.date,
      authors: [frontmatter.author],
      url: `https://www.propertyiq.app/blog/${slug}`,
      siteName: "PropertyIQ",
      tags: frontmatter.tags,
      ...(frontmatter.image && {
        images: [{ url: frontmatter.image }],
      }),
    },
    twitter: {
      card: "summary_large_image",
      title: frontmatter.title,
      description: frontmatter.description,
    },
  };
}

export default async function BlogPostPage({ params }: BlogPostPageProps) {
  const { slug } = await params;
  const post = getPostBySlug(slug);

  if (!post) {
    notFound();
  }

  const { frontmatter } = post;

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Article",
        headline: frontmatter.title,
        description: frontmatter.description,
        datePublished: frontmatter.date,
        dateModified: frontmatter.date,
        author: {
          "@type": "Organization",
          name: frontmatter.author,
          url: "https://www.propertyiq.app/about",
        },
        publisher: {
          "@type": "Organization",
          name: "PropertyIQ",
          url: "https://www.propertyiq.app",
        },
        mainEntityOfPage: {
          "@type": "WebPage",
          "@id": `https://www.propertyiq.app/blog/${slug}`,
        },
        ...(frontmatter.image && {
          image: frontmatter.image,
        }),
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
          {
            "@type": "ListItem",
            position: 3,
            name: frontmatter.title,
            item: `https://www.propertyiq.app/blog/${slug}`,
          },
        ],
      },
    ],
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <BlogPostContent post={post} />
      <RelatedPosts currentSlug={slug} />
    </div>
  );
}
