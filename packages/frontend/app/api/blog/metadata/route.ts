import { NextResponse } from "next/server";
import { getAllPosts } from "@/lib/blog";

/**
 * GET /api/blog/metadata
 *
 * Returns lightweight metadata for all published blog posts.
 * Used by the backend AI insights engine to provide content-aware
 * marketing recommendations without hardcoding blog content.
 */
export async function GET() {
  const posts = getAllPosts();

  const metadata = posts.map((post) => ({
    slug: post.slug,
    title: post.frontmatter.title,
    description: post.frontmatter.description,
    date: post.frontmatter.date,
    category: post.frontmatter.category,
    targetKeyword: post.frontmatter.targetKeyword,
    tags: post.frontmatter.tags,
    readingTime: post.readingTime,
  }));

  return NextResponse.json(metadata, {
    headers: { "Cache-Control": "public, max-age=3600" },
  });
}
