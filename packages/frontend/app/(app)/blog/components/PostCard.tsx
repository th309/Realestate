import Link from "next/link";

export interface BlogPostSummary {
  slug: string;
  frontmatter: {
    title: string;
    description: string;
    date: string;
    category: string;
    tags: string[];
  };
  readingTime: string;
}

export function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function CategoryChip({ category }: { category: string }) {
  return (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary-container text-on-primary-container">
      {category.replace(/-/g, " ")}
    </span>
  );
}

export function PostCard({
  post,
  featured = false,
}: {
  post: BlogPostSummary;
  featured?: boolean;
}) {
  return (
    <article
      className={`bg-surface-container-low rounded-xl border border-outline-variant/50 hover:shadow-md transition-shadow ${
        featured ? "p-6" : "p-4"
      }`}
    >
      <div className="flex items-center gap-3 mb-2">
        <CategoryChip category={post.frontmatter.category} />
        <time
          dateTime={post.frontmatter.date}
          className="text-xs text-on-surface-variant"
        >
          {formatDate(post.frontmatter.date)}
        </time>
        <span className="text-xs text-on-surface-variant">
          {post.readingTime}
        </span>
      </div>
      <Link href={`/blog/${post.slug}`} className="group">
        <h3
          className={`font-medium text-on-surface group-hover:text-primary transition-colors ${featured ? "text-xl" : "text-base"}`}
        >
          {post.frontmatter.title}
        </h3>
      </Link>
      {featured && (
        <p className="mt-2 text-sm text-on-surface-variant leading-relaxed line-clamp-2">
          {post.frontmatter.description}
        </p>
      )}
    </article>
  );
}
