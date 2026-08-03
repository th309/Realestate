import Link from "next/link";
import Image from "next/image";
import { Chip } from "@/app/components/marketing";

export interface BlogPostSummary {
  slug: string;
  frontmatter: {
    title: string;
    description: string;
    date: string;
    category: string;
    tags: string[];
    image?: string;
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
  return <Chip>{category.replace(/-/g, " ")}</Chip>;
}

/**
 * A blog index card.
 *
 * Every card now leads with the post's 16:9 hero image and always shows its
 * description — the description used to be gated behind `featured`, so the
 * index read as a wall of bare titles with nothing to choose between. Now
 * `featured` controls scale only, never which information survives.
 */
export function PostCard({
  post,
  featured = false,
}: {
  post: BlogPostSummary;
  featured?: boolean;
}) {
  const { title, description, date, category, image } = post.frontmatter;

  return (
    <article className="group overflow-hidden rounded-xl border border-outline-variant/50 bg-surface-container-low shadow-sm transition-shadow hover:shadow-md">
      {image ? (
        <Link href={`/blog/${post.slug}`} className="block" tabIndex={-1}>
          <Image
            src={image}
            alt={title}
            width={1280}
            height={720}
            sizes="(min-width: 768px) 50vw, 100vw"
            className="aspect-video h-auto w-full object-cover"
          />
        </Link>
      ) : null}

      <div className={featured ? "p-6" : "p-5"}>
        <div className="mb-3 flex items-center gap-3">
          <CategoryChip category={category} />
          <time
            dateTime={date}
            className="min-w-0 truncate text-xs text-on-surface-variant"
          >
            {formatDate(date)}
          </time>
          <span className="min-w-0 truncate text-xs text-on-surface-variant">
            {post.readingTime}
          </span>
        </div>

        <Link href={`/blog/${post.slug}`}>
          <h3
            className={`font-semibold tracking-tight text-on-surface transition-colors group-hover:text-primary ${
              featured ? "text-xl" : "text-lg"
            }`}
          >
            {title}
          </h3>
        </Link>

        <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-on-surface-variant">
          {description}
        </p>
      </div>
    </article>
  );
}
