"use client";

import { useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { Search, MapPin, X, BookOpen } from "lucide-react";
import { useUniversalSearch } from "@/app/shared/hooks/useUniversalSearch";

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

type BlogGroup = "city" | "roundup" | "comparison" | "strategy";

const GROUP_LABELS: Record<BlogGroup, string> = {
  city: "City & Metro Analysis",
  roundup: "State & Regional Roundups",
  comparison: "Market Comparisons",
  strategy: "Strategy & Methodology",
};

const GROUP_ORDER: BlogGroup[] = ["city", "roundup", "comparison", "strategy"];

function classifyPost(
  slug: string,
  category: string,
  tags: string[],
): BlogGroup {
  if (slug.includes("-vs-") || slug.includes("comparison")) return "comparison";
  if (
    category === "methodology" ||
    category === "investment" ||
    slug.includes("best-cash-flow-") ||
    slug.includes("rent-to-price-") ||
    slug.includes("passive-income-") ||
    slug.includes("fastest-selling-") ||
    slug.includes("best-cities-for-airbnb-")
  )
    return "strategy";
  if (
    slug.match(/best-real-estate-markets-\w+-\d{4}/) ||
    slug.includes("best-states-") ||
    slug.match(/\w+-real-estate-markets-\d{4}/) ||
    tags.some((t) =>
      [
        "state-roundup",
        "sun-belt",
        "midwest",
        "northeast",
        "southeast",
      ].includes(t),
    )
  )
    return "roundup";
  return "city";
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
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

function PostCard({
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

function PostSection({
  group,
  posts,
}: {
  group: BlogGroup;
  posts: BlogPostSummary[];
}) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? posts : posts.slice(0, 6);

  return (
    <section className="mt-10">
      <div className="flex items-baseline justify-between mb-4">
        <h2 className="text-lg font-semibold text-on-surface">
          {GROUP_LABELS[group]}{" "}
          <span className="text-on-surface-variant font-normal text-sm">
            ({posts.length})
          </span>
        </h2>
        {posts.length > 6 && !expanded && (
          <button
            onClick={() => setExpanded(true)}
            className="text-sm font-medium text-primary hover:text-primary/80 transition-colors"
          >
            Show all {posts.length} posts →
          </button>
        )}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {visible.map((post) => (
          <PostCard key={post.slug} post={post} />
        ))}
      </div>
      {expanded && posts.length > 6 && (
        <button
          onClick={() => setExpanded(false)}
          className="mt-4 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
        >
          Show less
        </button>
      )}
    </section>
  );
}

export function BlogIndexContent({ posts }: { posts: BlogPostSummary[] }) {
  const [textFilter, setTextFilter] = useState("");
  const [marketFilter, setMarketFilter] = useState<string | null>(null);
  const [marketDisplayName, setMarketDisplayName] = useState<string | null>(
    null,
  );
  const {
    searchQuery,
    searchResults,
    searchLoading,
    showSearchResults,
    setShowSearchResults,
    searchRef,
    handleSearch,
    clearSearch,
  } = useUniversalSearch({});

  const handleSelectMarket = useCallback(
    (result: { name: string }) => {
      // Store the primary name before comma: "Atlanta-Sandy Springs-Roswell, GA" → "atlanta-sandy springs-roswell"
      const marketName = result.name.split(",")[0].trim().toLowerCase();
      setMarketFilter(marketName);
      setMarketDisplayName(result.name.split(",")[0].trim());
      clearSearch();
    },
    [clearSearch],
  );

  const clearMarketFilter = useCallback(() => {
    setMarketFilter(null);
    setMarketDisplayName(null);
  }, []);

  const filteredPosts = useMemo(() => {
    let result = posts;
    if (marketFilter) {
      result = result.filter((p) =>
        p.frontmatter.tags.some((tag) => {
          const t = tag.toLowerCase();
          // Match bidirectionally: tag "atlanta" is in filter "atlanta-sandy springs-roswell"
          // OR filter "atlanta" is in tag "atlanta-real-estate"
          return marketFilter.includes(t) || t.includes(marketFilter);
        }),
      );
    }
    if (textFilter.length >= 2) {
      const lower = textFilter.toLowerCase();
      result = result.filter(
        (p) =>
          p.frontmatter.title.toLowerCase().includes(lower) ||
          p.frontmatter.description.toLowerCase().includes(lower),
      );
    }
    return result;
  }, [posts, marketFilter, textFilter]);

  const isFiltered = marketFilter || textFilter.length >= 2;

  const grouped = useMemo(() => {
    const groups: Record<BlogGroup, BlogPostSummary[]> = {
      city: [],
      roundup: [],
      comparison: [],
      strategy: [],
    };
    for (const post of filteredPosts) {
      const group = classifyPost(
        post.slug,
        post.frontmatter.category,
        post.frontmatter.tags,
      );
      groups[group].push(post);
    }
    return groups;
  }, [filteredPosts]);

  const featured = posts.slice(0, 3);

  return (
    <div className="mt-8">
      <div className="flex flex-col sm:flex-row gap-3">
        <div
          ref={searchRef as React.RefObject<HTMLDivElement>}
          className="relative flex-1"
        >
          <div className="flex items-center bg-surface-container-low rounded-lg border border-outline-variant px-4 py-2.5 gap-2">
            <MapPin className="w-4 h-4 text-on-surface-variant flex-shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              onFocus={() => {
                if (searchQuery.length >= 2) setShowSearchResults(true);
              }}
              placeholder="Search by market..."
              className="flex-1 bg-transparent text-sm text-on-surface placeholder:text-on-surface-variant/60 outline-none"
            />
          </div>
          {showSearchResults && (
            <div className="absolute top-full mt-1 w-full bg-surface-container-lowest rounded-xl shadow-lg border border-outline-variant/30 z-50 overflow-hidden">
              <div className="max-h-60 overflow-y-auto">
                {searchLoading && (
                  <div className="flex items-center gap-2 px-4 py-3">
                    <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    <span className="text-sm text-on-surface-variant">
                      Searching...
                    </span>
                  </div>
                )}
                {!searchLoading &&
                  searchResults.length === 0 &&
                  searchQuery.length >= 2 && (
                    <p className="px-4 py-3 text-sm text-on-surface-variant text-center">
                      No markets found
                    </p>
                  )}
                {searchResults.map((r) => (
                  <button
                    key={`${r.type}-${r.id}`}
                    onClick={() => handleSelectMarket(r)}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-surface-container transition-colors"
                  >
                    <MapPin className="w-4 h-4 text-on-surface-variant flex-shrink-0" />
                    <span className="text-sm text-on-surface">{r.name}</span>
                    <span className="text-[10px] text-on-surface-variant/60 uppercase tracking-wider ml-auto bg-surface-container-high px-1.5 py-0.5 rounded">
                      {r.type}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center bg-surface-container-low rounded-lg border border-outline-variant px-4 py-2.5 gap-2 sm:w-64">
          <Search className="w-4 h-4 text-on-surface-variant flex-shrink-0" />
          <input
            type="text"
            value={textFilter}
            onChange={(e) => setTextFilter(e.target.value)}
            placeholder="Filter by keyword..."
            className="flex-1 bg-transparent text-sm text-on-surface placeholder:text-on-surface-variant/60 outline-none"
          />
        </div>
      </div>

      {marketFilter && (
        <div className="mt-3 flex items-center gap-2">
          <span className="text-sm text-on-surface-variant">
            Showing posts about
          </span>
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-primary-container text-on-primary-container text-sm font-medium">
            {marketDisplayName || marketFilter}
            <button
              onClick={clearMarketFilter}
              className="ml-1 hover:text-primary"
              aria-label="Clear filter"
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        </div>
      )}

      {isFiltered ? (
        <section className="mt-6">
          <p className="text-sm text-on-surface-variant mb-4">
            {filteredPosts.length} post{filteredPosts.length !== 1 ? "s" : ""}{" "}
            found
          </p>
          {filteredPosts.length === 0 ? (
            <div className="text-center py-16">
              <BookOpen className="w-12 h-12 text-on-surface-variant mx-auto mb-4 opacity-50" />
              <p className="text-lg text-on-surface-variant">
                No posts match your filters.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredPosts.map((post) => (
                <PostCard key={post.slug} post={post} />
              ))}
            </div>
          )}
        </section>
      ) : (
        <>
          <section className="mt-8">
            <h2 className="text-lg font-semibold text-on-surface mb-4">
              Latest
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {featured.map((post) => (
                <PostCard key={post.slug} post={post} featured />
              ))}
            </div>
          </section>

          {GROUP_ORDER.map((group) =>
            grouped[group].length > 0 ? (
              <PostSection key={group} group={group} posts={grouped[group]} />
            ) : null,
          )}
        </>
      )}
    </div>
  );
}
