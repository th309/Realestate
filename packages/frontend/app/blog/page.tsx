import Link from 'next/link';
import { BookOpen } from 'lucide-react';
import { getAllPosts } from '@/lib/blog';
import { PageHeaderWithBreadcrumbs } from '@/components/navigation';

const CATEGORIES = [
  { id: 'all', label: 'All Posts' },
  { id: 'market-analysis', label: 'Market Analysis' },
  { id: 'investment', label: 'Investment' },
  { id: 'methodology', label: 'Methodology' },
  { id: 'news', label: 'News' },
] as const;

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function CategoryChip({ category }: { category: string }) {
  return (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary-container text-on-primary-container">
      {category.replace(/-/g, ' ')}
    </span>
  );
}

function TagChip({ tag }: { tag: string }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs text-on-surface-variant bg-surface-container">
      {tag}
    </span>
  );
}

export default function BlogIndexPage() {
  const posts = getAllPosts();

  return (
    <div className="min-h-screen">
      <PageHeaderWithBreadcrumbs
        breadcrumbs={[{ label: 'Blog' }]}
        title="PropertyIQ Blog"
        description="Data-driven housing market analysis, forecasts, and investment insights."
        icon={<BookOpen className="w-5 h-5" />}
      />

      {/* Category filter links */}
      <nav className="mt-8 flex flex-wrap gap-2" aria-label="Blog categories">
        {CATEGORIES.map(({ id, label }) => (
          <a
            key={id}
            href={id === 'all' ? '#all' : `#${id}`}
            className="px-4 py-1.5 rounded-lg text-sm font-medium border border-outline-variant text-on-surface-variant hover:bg-primary hover:text-on-primary hover:border-primary transition-colors"
          >
            {label}
          </a>
        ))}
      </nav>

      {/* Post listing */}
      <section className="mt-8 space-y-6">
        {posts.length === 0 ? (
          <div className="text-center py-16">
            <BookOpen className="w-12 h-12 text-on-surface-variant mx-auto mb-4 opacity-50" />
            <p className="text-lg text-on-surface-variant">
              No posts yet. Check back soon!
            </p>
          </div>
        ) : (
          posts.map(post => (
            <article
              key={post.slug}
              className="bg-surface-container-low rounded-xl p-6 shadow-sm border border-outline-variant/50 hover:shadow-md transition-shadow"
            >
              <div className="flex items-center gap-3 mb-3">
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
                <h2 className="text-xl font-medium text-on-surface group-hover:text-primary transition-colors">
                  {post.frontmatter.title}
                </h2>
              </Link>

              <p className="mt-2 text-sm text-on-surface-variant leading-relaxed line-clamp-2">
                {post.frontmatter.description}
              </p>

              {post.frontmatter.tags.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {post.frontmatter.tags.map(tag => (
                    <TagChip key={tag} tag={tag} />
                  ))}
                </div>
              )}
            </article>
          ))
        )}
      </section>
    </div>
  );
}
