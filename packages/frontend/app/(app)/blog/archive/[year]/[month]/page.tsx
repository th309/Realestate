import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CalendarDays } from "lucide-react";
import { PageHeaderWithBreadcrumbs } from "@/components/navigation";
import type { BlogPost } from "@/lib/blog";
import { getArchiveTree, getPostsByMonth, monthName } from "@/lib/blog/archive";
import { PostCard, type BlogPostSummary } from "../../../components/PostCard";

interface MonthPageProps {
  params: Promise<{ year: string; month: string }>;
}

export function generateStaticParams() {
  return getArchiveTree().flatMap((y) =>
    y.months.map((m) => ({ year: y.year, month: m.month })),
  );
}

export async function generateMetadata({
  params,
}: MonthPageProps): Promise<Metadata> {
  const { year, month } = await params;
  const label = `${monthName(month)} ${year}`;
  return {
    title: `${label} Blog Archive`,
    description: `PropertyIQ housing market analysis published in ${label}.`,
    alternates: {
      canonical: `https://www.propertyiq.app/blog/archive/${year}/${month}`,
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

export default async function BlogArchiveMonthPage({ params }: MonthPageProps) {
  const { year, month } = await params;
  const posts = getPostsByMonth(year, month);
  if (posts.length === 0) notFound();

  const label = `${monthName(month)} ${year}`;

  return (
    <div className="min-h-screen">
      <PageHeaderWithBreadcrumbs
        breadcrumbs={[
          { label: "Blog", href: "/blog" },
          { label: "Archive", href: "/blog/archive" },
          { label: year, href: `/blog/archive/${year}` },
          { label: monthName(month) },
        ]}
        title={`${label} Archive`}
        description={`${posts.length} post${posts.length !== 1 ? "s" : ""} published in ${label}.`}
        icon={<CalendarDays className="w-5 h-5" />}
      />
      <div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {posts.map((post) => (
          <PostCard key={post.slug} post={toSummary(post)} />
        ))}
      </div>
    </div>
  );
}
