/**
 * Published-posts feed for the window — thumbnail-less cards: platform glyph,
 * hook line, published date, and reach/engagement. Links out to the live post
 * when a permalink exists.
 */
import type { InsightPost } from "../lib/insights-api";
import { PlatformGlyph } from "../planner/platform-glyph";
import { formatCompactNumber } from "./insights-format";

const DATE_FMT = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
});

function prettyPostType(postType: string): string {
  return (postType || "post").replace(/_/g, " ");
}

export function PublishedPostsList({ posts }: { posts: InsightPost[] }) {
  return (
    <section aria-labelledby="published-posts-heading" className="space-y-3">
      <h2
        id="published-posts-heading"
        className="text-xs font-semibold uppercase tracking-[0.14em] text-on-surface-variant"
      >
        Published posts
      </h2>
      <ul className="space-y-2">
        {posts.map((post) => (
          <li
            key={post.postId}
            className="flex items-center gap-4 rounded-xl border border-outline-variant bg-surface p-3"
          >
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <PlatformGlyph platform={post.platform} />
              <div className="min-w-0">
                <div className="truncate text-sm font-medium text-on-surface">
                  {post.hook?.trim() || prettyPostType(post.postType)}
                </div>
                <div className="mt-0.5 text-xs text-on-surface-variant">
                  <span className="capitalize">
                    {prettyPostType(post.postType)}
                  </span>{" "}
                  · {DATE_FMT.format(new Date(post.publishedAt))}
                </div>
              </div>
            </div>

            <dl className="flex shrink-0 items-center gap-5">
              <Metric label="Reach" value={formatCompactNumber(post.reach)} />
              <Metric
                label="Engagement"
                value={formatCompactNumber(post.engagement)}
              />
            </dl>

            {post.permalink && (
              <a
                href={post.permalink}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Open post in a new tab"
                className="shrink-0 rounded p-1 text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <path d="M14 3h7v7M21 3l-9 9M10 5H5v14h14v-5" />
                </svg>
              </a>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-right">
      <dt className="text-[10px] uppercase tracking-wide text-on-surface-variant">
        {label}
      </dt>
      <dd className="font-mono text-sm tabular-nums text-on-surface">
        {value}
      </dd>
    </div>
  );
}
