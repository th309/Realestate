import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays } from "lucide-react";
import { PageHeaderWithBreadcrumbs } from "@/components/navigation";
import { getArchiveTree } from "@/lib/blog/archive";

export const metadata: Metadata = {
  title: "Blog Archive by Date",
  description:
    "Browse every PropertyIQ housing market analysis by publication month.",
  alternates: { canonical: "https://www.propertyiq.app/blog/archive" },
};

export default function BlogArchiveIndexPage() {
  const tree = getArchiveTree();

  return (
    <div className="min-h-screen">
      <PageHeaderWithBreadcrumbs
        breadcrumbs={[{ label: "Blog", href: "/blog" }, { label: "Archive" }]}
        title="Blog Archive"
        description="Every post, organized by publication month."
        icon={<CalendarDays className="w-5 h-5" />}
      />
      <div className="mt-8 space-y-8">
        {tree.map((year) => (
          <section key={year.year}>
            <h2 className="text-lg font-semibold text-on-surface mb-3">
              <Link
                href={`/blog/archive/${year.year}`}
                className="hover:text-primary transition-colors"
              >
                {year.year}
              </Link>{" "}
              <span className="text-on-surface-variant font-normal text-sm">
                ({year.count})
              </span>
            </h2>
            <div className="flex flex-wrap gap-2">
              {year.months.map((m) => (
                <Link
                  key={m.month}
                  href={`/blog/archive/${year.year}/${m.month}`}
                  className="inline-flex items-center px-3 py-1 rounded-full bg-primary-container text-on-primary-container text-sm font-medium hover:shadow-sm transition-shadow"
                >
                  {m.name} ({m.count})
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
