import Link from "next/link";
import { CalendarDays, MapPin } from "lucide-react";
import type { ArchiveYear, StateIndex } from "@/lib/blog/archive";

function BrowseCard({
  icon,
  title,
  seeAllHref,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  seeAllHref: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-surface-container-low rounded-xl border border-outline-variant/50 p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {icon}
          <h3 className="text-sm font-semibold text-on-surface">{title}</h3>
        </div>
        <Link
          href={seeAllHref}
          className="text-sm font-medium text-primary hover:text-primary/80 transition-colors"
        >
          See all →
        </Link>
      </div>
      {children}
    </div>
  );
}

export function BlogBrowsePanel({
  tree,
  stateIndex,
}: {
  tree: ArchiveYear[];
  stateIndex: StateIndex;
}) {
  return (
    <section className="mt-10">
      <h2 className="text-lg font-semibold text-on-surface mb-4">
        Browse the archive
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <BrowseCard
          icon={<CalendarDays className="w-4 h-4 text-on-surface-variant" />}
          title="By month"
          seeAllHref="/blog/archive"
        >
          <div className="space-y-3">
            {tree.map((year) => (
              <div key={year.year}>
                <Link
                  href={`/blog/archive/${year.year}`}
                  className="text-sm font-medium text-on-surface hover:text-primary transition-colors"
                >
                  {year.year}{" "}
                  <span className="text-on-surface-variant font-normal">
                    ({year.count})
                  </span>
                </Link>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {year.months.map((m) => (
                    <Link
                      key={m.month}
                      href={`/blog/archive/${year.year}/${m.month}`}
                      className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-primary-container text-on-primary-container text-xs font-medium hover:shadow-sm transition-shadow"
                    >
                      {m.name.slice(0, 3)} ({m.count})
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </BrowseCard>

        <BrowseCard
          icon={<MapPin className="w-4 h-4 text-on-surface-variant" />}
          title="By state"
          seeAllHref="/blog/states"
        >
          <div className="flex flex-wrap gap-1.5">
            {stateIndex.states.map((s) => (
              <Link
                key={s.abbrev}
                href={`/blog/states/${s.slug}`}
                className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-primary-container text-on-primary-container text-xs font-medium hover:shadow-sm transition-shadow"
              >
                {s.name} ({s.count})
              </Link>
            ))}
            {stateIndex.nationalCount > 0 && (
              <Link
                href="/blog/states/national"
                className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-surface-container-high text-on-surface text-xs font-medium hover:shadow-sm transition-shadow"
              >
                National ({stateIndex.nationalCount})
              </Link>
            )}
          </div>
        </BrowseCard>
      </div>
    </section>
  );
}
