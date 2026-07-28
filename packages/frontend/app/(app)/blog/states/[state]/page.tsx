import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MapPin } from "lucide-react";
import { PageHeaderWithBreadcrumbs } from "@/components/navigation";
import type { BlogPost } from "@/lib/blog";
import {
  getStateIndex,
  getPostsByState,
  NATIONAL_SLUG,
} from "@/lib/blog/archive";
import { SLUG_TO_STATE } from "@/lib/data/state-slug-data";
import { PostCard, type BlogPostSummary } from "../../components/PostCard";

interface StatePageProps {
  params: Promise<{ state: string }>;
}

export function generateStaticParams() {
  const { states, nationalCount } = getStateIndex();
  const params = states.map((s) => ({ state: s.slug }));
  if (nationalCount > 0) params.push({ state: NATIONAL_SLUG });
  return params;
}

function displayName(stateSlug: string): string {
  if (stateSlug === NATIONAL_SLUG) return "National & Multi-Market";
  return SLUG_TO_STATE.get(stateSlug)?.name ?? stateSlug;
}

export async function generateMetadata({
  params,
}: StatePageProps): Promise<Metadata> {
  const { state } = await params;
  const name = displayName(state);
  return {
    title: `${name} Real Estate Blog Posts`,
    description: `PropertyIQ housing market analysis covering ${name}.`,
    alternates: {
      canonical: `https://www.propertyiq.app/blog/states/${state}`,
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

export default async function BlogStatePage({ params }: StatePageProps) {
  const { state } = await params;
  const posts = getPostsByState(state);
  if (posts.length === 0) notFound();

  const name = displayName(state);

  return (
    <div className="min-h-screen">
      <PageHeaderWithBreadcrumbs
        breadcrumbs={[
          { label: "Blog", href: "/blog" },
          { label: "By State", href: "/blog/states" },
          { label: name },
        ]}
        title={`${name} Posts`}
        description={`${posts.length} post${posts.length !== 1 ? "s" : ""} covering ${name}.`}
        icon={<MapPin className="w-5 h-5" />}
      />
      <div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {posts.map((post) => (
          <PostCard key={post.slug} post={toSummary(post)} />
        ))}
      </div>
    </div>
  );
}
