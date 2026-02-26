"use client";

import { useState } from "react";
import Link from "next/link";
import { BookOpen } from "lucide-react";

const CATEGORIES = [
  { id: "all", label: "All Posts" },
  { id: "market-analysis", label: "Market Analysis" },
  { id: "investment", label: "Investment" },
  { id: "methodology", label: "Methodology" },
  { id: "news", label: "News" },
] as const;

interface BlogPostSummary {
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

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function CategoryChip({ category }: { category: string }) {
  return (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary-container text-on-primary-container">
      {category.replace(/-/g, " ")}
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

export function BlogFilterableList({ posts }: { posts: BlogPostSummary[] }) {
  const [activeCategory, setActiveCategory] = useState<string>("all");

  const filteredPosts =
    activeCategory === "all"
      ? posts
      : posts.filter((post) => post.frontmatter.category === activeCategory);

  return (
    <>
      {/* Category filter chips */}
      <nav className="mt-8 flex flex-wrap gap-2" aria-label="Blog categories">
        {CATEGORIES.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => setActiveCategory(id)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
              activeCategory === id
                ? "bg-primary text-on-primary border-primary"
                : "border-outline-variant text-on-surface-variant hover:bg-primary hover:text-on-primary hover:border-primary"
            }`}
          >
            {label}
          </button>
        ))}
      </nav>

      {/* Post listing */}
      <section className="mt-8 space-y-6">
        {filteredPosts.length === 0 ? (
          <div className="text-center py-16">
            <BookOpen className="w-12 h-12 text-on-surface-variant mx-auto mb-4 opacity-50" />
            <p className="text-lg text-on-surface-variant">
              {activeCategory === "all"
                ? "No posts yet. Check back soon!"
                : "No posts in this category yet."}
            </p>
          </div>
        ) : (
          filteredPosts.map((post) => (
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
                  {post.frontmatter.tags.map((tag) => (
                    <TagChip key={tag} tag={tag} />
                  ))}
                </div>
              )}
            </article>
          ))
        )}
      </section>
    </>
  );
}
