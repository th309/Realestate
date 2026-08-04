import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { getAllPosts, type BlogPost } from "@/lib/blog";
import { Section, SectionHeading } from "@/app/components/marketing";

/**
 * Homepage blog band — the four most recent posts as a two-column card grid.
 *
 * The mockup drew each thumbnail as a CSS gradient carrying a category eyebrow,
 * a display title, and a monospace headline figure. Those were a stand-in: every
 * post already ships exactly that composition as a real branded PNG, rendered by
 * `scripts/content/generate-post-images.ts` at 1280x720 and stored in the post's
 * own `image` frontmatter. So the card renders the generated image rather than
 * re-drawing an approximation of it in CSS, and nothing on this band is invented
 * — title, description, date, and reading time all come from the post itself.
 *
 * The loader is filesystem-backed, so this MUST stay a server component.
 */

/** The grid is two columns; four posts fill exactly two rows at every width. */
const POSTS_SHOWN = 4;

/**
 * Post dates are bare `YYYY-MM-DD`, which `Date` reads as UTC midnight. Without
 * pinning the zone, a viewer west of UTC sees every post dated a day early.
 */
function formatPostDate(date: string): string {
  return new Date(date).toLocaleDateString("en-US", {
    timeZone: "UTC",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function BlogPreviewCard({ post }: { post: BlogPost }) {
  const { title, description, date, image } = post.frontmatter;

  return (
    <article className="group relative flex flex-col overflow-hidden rounded-xl border border-outline-variant bg-surface shadow-sm transition-shadow duration-200 hover:shadow-md">
      {image ? (
        <Image
          src={image}
          /* Decorative: the generated card renders this post's own title, which
             the h3 below already announces. Alt text would say it twice. */
          alt=""
          width={1280}
          height={720}
          sizes="(min-width: 768px) 50vw, 100vw"
          className="aspect-video w-full object-cover"
        />
      ) : null}

      <div className="flex flex-1 flex-col gap-3 p-6">
        <h3 className="text-xl font-semibold leading-snug tracking-tight text-on-surface transition-colors duration-200 group-hover:text-primary">
          {/* Stretched link: one target per card, and its accessible name is the
              post title alone rather than the whole card's text. */}
          <Link
            href={`/blog/${post.slug}`}
            className="after:absolute after:inset-0"
          >
            {title}
          </Link>
        </h3>

        <p className="line-clamp-3 text-[14.5px] leading-relaxed text-on-surface-variant">
          {description}
        </p>

        <p className="mt-auto flex items-center gap-2.5 pt-1.5 text-[13.5px] text-on-surface-variant">
          <time dateTime={date}>{formatPostDate(date)}</time>
          <span aria-hidden="true">&middot;</span>
          <span>{post.readingTime}</span>
        </p>
      </div>
    </article>
  );
}

export function BlogPreview() {
  const posts = getAllPosts().slice(0, POSTS_SHOWN);

  if (posts.length === 0) return null;

  return (
    <Section surface="a">
      <SectionHeading
        title="The PropertyIQ Blog"
        subhead="Market breakdowns and rankings, generated from the same scored dataset that powers the product."
      />

      <div className="grid grid-cols-1 gap-7 md:grid-cols-2">
        {posts.map((post) => (
          <BlogPreviewCard key={post.slug} post={post} />
        ))}
      </div>

      <div className="mt-10 flex justify-center">
        <Link
          href="/blog"
          className="inline-flex items-center gap-2 rounded-full border border-outline-variant bg-surface px-6 py-3 text-sm font-semibold text-on-surface shadow-sm transition-colors duration-200 hover:bg-surface-container"
        >
          Read the blog
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>
    </Section>
  );
}
