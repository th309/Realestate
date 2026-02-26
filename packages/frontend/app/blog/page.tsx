import { BookOpen } from "lucide-react";
import { getAllPosts } from "@/lib/blog";
import { PageHeaderWithBreadcrumbs } from "@/components/navigation";
import { BlogFilterableList } from "./BlogFilterableList";

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

  return (
    <div className="min-h-screen">
      <PageHeaderWithBreadcrumbs
        breadcrumbs={[{ label: "Blog" }]}
        title="PropertyIQ Blog"
        description="Data-driven housing market analysis, forecasts, and investment insights."
        icon={<BookOpen className="w-5 h-5" />}
      />

      <BlogFilterableList posts={postSummaries} />
    </div>
  );
}
