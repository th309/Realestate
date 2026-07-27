import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CalendarDays } from "lucide-react";
import { PageHeaderWithBreadcrumbs } from "@/components/navigation";
import { getAllPosts, type BlogPost } from "@/lib/blog";
import { getArchiveTree, filterPostsByMonth } from "@/lib/blog/archive";
import { PostCard, type BlogPostSummary } from "../../components/PostCard";

interface YearPageProps {
  params: Promise<{ year: string }>;
}

export function generateStaticParams() {
  return getArchiveTree().map(({ year }) => ({ year }));
}

export async function generateMetadata({
  params,
}: YearPageProps): Promise<Metadata> {
  const { year } = await params;
  return {
    title: `${year} Blog Archive`,
    description: `PropertyIQ housing market analysis published in ${year}.`,
    alternates: {
      canonical: `https://www.propertyiq.app/blog/archive/${year}`,
    },
  };
}

const toSummary = (post: BlogPost): BlogPostSummary => ({
  slug: post.slug,
  frontmatter: {
    title: post.frontmatter.title,
    description: post.frontmatter.description,
    date: post.frontmatter.date,
    category: post.frontmatter.category,
    tags: post.frontmatter.tags,
  },
  readingTime: post.readingTime,
});

export default async function BlogArchiveYearPage({ params }: YearPageProps) {
  const { year } = await params;
  const yearEntry = getArchiveTree().find((y) => y.year === year);
  if (!yearEntry) notFound();

  const posts = getAllPosts();

  return (
    <div className="min-h-screen">
      <PageHeaderWithBreadcrumbs
        breadcrumbs={[
          { label: "Blog", href: "/blog" },
          { label: "Archive", href: "/blog/archive" },
          { label: year },
        ]}
        title={`${year} Archive`}
        description={`${yearEntry.count} post${yearEntry.count !== 1 ? "s" : ""} published in ${year}.`}
        icon={<CalendarDays className="w-5 h-5" />}
      />
      <div className="mt-8 space-y-10">
        {yearEntry.months.map((m) => (
          <section key={m.month}>
            <h2 className="text-lg font-semibold text-on-surface mb-4">
              {m.name} {year}{" "}
              <span className="text-on-surface-variant font-normal text-sm">
                ({m.count})
              </span>
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filterPostsByMonth(posts, year, m.month).map((post) => (
                <PostCard key={post.slug} post={toSummary(post)} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
