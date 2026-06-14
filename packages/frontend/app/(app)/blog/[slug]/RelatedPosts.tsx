import { getAllPosts } from "@/lib/blog";

interface RelatedPostsProps {
  currentSlug: string;
}

export function RelatedPosts({ currentSlug }: RelatedPostsProps) {
  const allPosts = getAllPosts();
  const related = allPosts
    .filter((post) => post.slug !== currentSlug)
    .slice(0, 3);

  if (related.length === 0) return null;

  return (
    <section className="mt-16 pt-12 border-t border-outline-variant">
      <h2 className="text-xl font-medium text-on-surface mb-6">
        Related Articles
      </h2>
      <div className="grid sm:grid-cols-3 gap-6">
        {related.map((post) => (
          <a
            key={post.slug}
            href={`/blog/${post.slug}`}
            className="group block p-4 rounded-xl border border-outline-variant hover:border-primary/30 hover:bg-surface-container-low transition-colors"
          >
            <span className="text-xs text-primary font-medium uppercase tracking-wide">
              {post.frontmatter.category}
            </span>
            <h3 className="text-sm font-medium text-on-surface mt-2 group-hover:text-primary transition-colors line-clamp-2">
              {post.frontmatter.title}
            </h3>
            <p className="text-xs text-on-surface-variant mt-2 line-clamp-2">
              {post.frontmatter.description}
            </p>
          </a>
        ))}
      </div>
    </section>
  );
}
