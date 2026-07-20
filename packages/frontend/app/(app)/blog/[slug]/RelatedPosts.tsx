import { getAllPosts } from "@/lib/blog";
import type { BlogPost } from "@/lib/blog";

interface RelatedPostsProps {
  currentSlug: string;
}

function relatednessScore(current: BlogPost, candidate: BlogPost): number {
  const currentTags = new Set(current.frontmatter.tags);
  const sharedTags = candidate.frontmatter.tags.filter((tag) =>
    currentTags.has(tag),
  ).length;
  const sameCategory =
    candidate.frontmatter.category === current.frontmatter.category ? 1 : 0;
  return sharedTags * 2 + sameCategory;
}

export function RelatedPosts({ currentSlug }: RelatedPostsProps) {
  const allPosts = getAllPosts();
  const current = allPosts.find((post) => post.slug === currentSlug);
  const others = allPosts.filter((post) => post.slug !== currentSlug);

  // Ranked by shared tags (then category, falling back to recency via the
  // stable sort) instead of always the 3 most-recently-published posts --
  // that meant any post older than the newest few never got linked from
  // this section again, regardless of topic.
  const related = current
    ? [...others]
        .sort(
          (a, b) => relatednessScore(current, b) - relatednessScore(current, a),
        )
        .slice(0, 3)
    : others.slice(0, 3);

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
