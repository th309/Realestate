import type { Metadata } from "next";
import Link from "next/link";
import { MapPin } from "lucide-react";
import { PageHeaderWithBreadcrumbs } from "@/components/navigation";
import { getStateIndex, NATIONAL_SLUG } from "@/lib/blog/archive";

export const metadata: Metadata = {
  title: "Blog Posts by State",
  description: "Browse PropertyIQ housing market analysis by U.S. state.",
  alternates: { canonical: "https://www.propertyiq.app/blog/states" },
};

export default function BlogStatesIndexPage() {
  const { states, nationalCount } = getStateIndex();

  return (
    <div className="min-h-screen">
      <PageHeaderWithBreadcrumbs
        breadcrumbs={[{ label: "Blog", href: "/blog" }, { label: "By State" }]}
        title="Blog Posts by State"
        description="Market analysis organized by the states each post covers."
        icon={<MapPin className="w-5 h-5" />}
      />
      <div className="mt-8 flex flex-wrap gap-2">
        {states.map((s) => (
          <Link
            key={s.abbrev}
            href={`/blog/states/${s.slug}`}
            className="inline-flex items-center px-3 py-1 rounded-full bg-primary-container text-on-primary-container text-sm font-medium hover:shadow-sm transition-shadow"
          >
            {s.name} ({s.count})
          </Link>
        ))}
        {nationalCount > 0 && (
          <Link
            href={`/blog/states/${NATIONAL_SLUG}`}
            className="inline-flex items-center px-3 py-1 rounded-full bg-surface-container-high text-on-surface text-sm font-medium hover:shadow-sm transition-shadow"
          >
            National &amp; Multi-Market ({nationalCount})
          </Link>
        )}
      </div>
    </div>
  );
}
