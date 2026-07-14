import type { Metadata } from "next";
import Link from "next/link";
import { Check, X, ArrowRight, ExternalLink } from "lucide-react";
import {
  ROUNDUP_TITLE,
  ROUNDUP_DESCRIPTION,
  ROUNDUP_CRITERIA,
  ROUNDUP_TOOLS,
  type RoundupTool,
} from "@/lib/data/comparisons/roundup";
import { fetchPricingSummary } from "@/lib/data/fetchers/pricing";
import { COMPARISONS } from "@/lib/data/comparisons";
import { RankingMatrix } from "./RankingMatrix";
import { FaqSection } from "@/app/components/seo/FaqSection";
import { COMPARE_INDEX_FAQS } from "./compare-index-faqs";

// ---------------------------------------------------------------------------
// Metadata
// ---------------------------------------------------------------------------

export const metadata: Metadata = {
  title: ROUNDUP_TITLE,
  description: ROUNDUP_DESCRIPTION,
  alternates: { canonical: "https://www.propertyiq.app/compare" },
  openGraph: {
    title: ROUNDUP_TITLE,
    description: ROUNDUP_DESCRIPTION,
    url: "https://www.propertyiq.app/compare",
    siteName: "PropertyIQ",
    images: [
      { url: "/og-image.png", width: 1200, height: 630, alt: ROUNDUP_TITLE },
    ],
  },
};

// ---------------------------------------------------------------------------
// Live pricing interpolation (shared token contract with /compare/[slug])
// ---------------------------------------------------------------------------

async function resolveProPrice(): Promise<string> {
  try {
    const pricing = await fetchPricingSummary();
    const pro = pricing.tiers.find((t) => t.slug === "pro");
    return pro?.price_monthly
      ? `$${Math.round(Number(pro.price_monthly))}`
      : "See pricing";
  } catch (error) {
    console.error("[compare] roundup pricing fetch failed:", error);
    return "See pricing";
  }
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function Breadcrumb() {
  return (
    <nav
      aria-label="Breadcrumb"
      className="flex items-center gap-1.5 text-sm text-on-surface-variant mb-6"
    >
      <Link href="/" className="hover:text-primary transition-colors">
        Home
      </Link>
      <span aria-hidden="true">/</span>
      <span className="text-on-surface font-medium">Compare</span>
    </nav>
  );
}

function RankBadge({ rank, highlight }: { rank: number; highlight?: boolean }) {
  return (
    <span
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-base font-semibold ${
        highlight
          ? "bg-primary text-on-primary"
          : "bg-surface-container-low text-on-surface-variant"
      }`}
      aria-hidden="true"
    >
      {rank}
    </span>
  );
}

function ToolCard({ tool }: { tool: RoundupTool }) {
  const isExternal = tool.url.startsWith("http");
  return (
    <article
      className={`rounded-xl border p-5 sm:p-6 ${
        tool.isPropertyiq
          ? "border-primary/40 bg-primary-container/30"
          : "border-outline-variant"
      }`}
    >
      <div className="flex items-start gap-3">
        <RankBadge rank={tool.rank} highlight={tool.isPropertyiq} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h3 className="text-xl font-medium text-on-surface">{tool.name}</h3>
            <span className="text-sm text-on-surface-variant">
              {tool.priceFrom}
            </span>
          </div>
          <p className="mt-0.5 text-sm font-medium text-primary">
            {tool.bestFor}
          </p>
        </div>
      </div>

      <p className="mt-4 text-sm leading-relaxed text-on-surface-variant">
        {tool.blurb}
      </p>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <ul className="space-y-1.5">
          {tool.pros.map((pro) => (
            <li key={pro} className="flex gap-2 text-sm text-on-surface">
              <Check
                className="mt-0.5 h-4 w-4 shrink-0 text-green-600 dark:text-green-400"
                aria-hidden="true"
              />
              <span>{pro}</span>
            </li>
          ))}
        </ul>
        <ul className="space-y-1.5">
          {tool.cons.map((con) => (
            <li
              key={con}
              className="flex gap-2 text-sm text-on-surface-variant"
            >
              <X
                className="mt-0.5 h-4 w-4 shrink-0 text-error"
                aria-hidden="true"
              />
              <span>{con}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
        {tool.comparisonSlug && (
          <Link
            href={`/compare/${tool.comparisonSlug}`}
            className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
          >
            PropertyIQ vs {tool.name} in detail
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        )}
        {isExternal ? (
          <a
            href={tool.url}
            target="_blank"
            rel="noopener nofollow"
            className="inline-flex items-center gap-1 text-on-surface-variant hover:text-on-surface"
          >
            Visit {tool.name}
            <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
          </a>
        ) : (
          <Link
            href={tool.url}
            className="inline-flex items-center gap-1 text-on-surface-variant hover:text-on-surface"
          >
            Explore PropertyIQ
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        )}
      </div>
    </article>
  );
}

function MoreComparisons() {
  // Complete index of every head-to-head comparison page, linked at the foot of
  // the hub (in addition to the inline links in the ranked cards above) so each
  // detailed comparison is one click away.
  if (COMPARISONS.length === 0) return null;
  return (
    <section className="mt-12 border-t border-outline-variant pt-8">
      <h2 className="mb-3 text-lg font-medium text-on-surface">
        More comparisons
      </h2>
      <ul className="space-y-2 text-sm">
        {COMPARISONS.map((c) => (
          <li key={c.slug}>
            <Link
              href={`/compare/${c.slug}`}
              className="text-primary hover:underline"
            >
              PropertyIQ vs {c.competitorName}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function CallToAction() {
  return (
    <section className="mt-12 text-center">
      <h2 className="text-xl font-medium text-on-surface">
        See your market&apos;s PropertyIQ Score free
      </h2>
      <p className="mx-auto mt-2 max-w-xl text-sm text-on-surface-variant">
        Open the map, search any metro, county, or ZIP, and read the validated
        score and confidence grade — no signup required.
      </p>
      <Link
        href="/pricing"
        className="mt-5 inline-flex items-center gap-2 rounded-full bg-primary px-8 py-3 text-sm font-medium text-on-primary transition-colors duration-200 hover:bg-primary/90"
      >
        Try PropertyIQ Free
      </Link>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function CompareHubPage() {
  const proPrice = await resolveProPrice();
  const tools = ROUNDUP_TOOLS.map((t) => ({
    ...t,
    priceFrom: t.priceFrom.replace(/\{\{PRO_PRICE\}\}/g, proPrice),
  }));

  const itemListJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: ROUNDUP_TITLE,
    itemListOrder: "https://schema.org/ItemListOrderAscending",
    numberOfItems: tools.length,
    itemListElement: tools.map((t) => ({
      "@type": "ListItem",
      position: t.rank,
      name: t.name,
      url: t.url.startsWith("http")
        ? t.url
        : `https://www.propertyiq.app${t.url}`,
    })),
  };

  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: ROUNDUP_TITLE,
    description: ROUNDUP_DESCRIPTION,
    image: ["https://www.propertyiq.app/og-image.png"],
    datePublished: "2026-06-20",
    dateModified: "2026-07-07",
    author: {
      "@type": "Person",
      "@id": "https://www.propertyiq.app/about#troy-h",
      name: "Troy H",
      honorificSuffix: "MBA",
      url: "https://www.propertyiq.app/about",
    },
    publisher: { "@id": "https://www.propertyiq.app/#organization" },
    mainEntityOfPage: "https://www.propertyiq.app/compare",
  };

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: "https://www.propertyiq.app",
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Compare",
        item: "https://www.propertyiq.app/compare",
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@graph": [itemListJsonLd, articleJsonLd, breadcrumbJsonLd],
          }),
        }}
      />

      <Breadcrumb />

      <h1 className="text-3xl font-medium tracking-tight text-on-surface">
        {ROUNDUP_TITLE}
      </h1>
      <p className="mt-3 leading-relaxed text-on-surface-variant">
        {ROUNDUP_DESCRIPTION}
      </p>

      {/* E-E-A-T: author + disclosure for YMYL content */}
      <p className="mt-3 text-sm text-on-surface-variant">
        Analysis by{" "}
        <a
          href="/about"
          className="font-medium text-on-surface underline-offset-2 hover:underline"
        >
          Troy H, MBA
        </a>{" "}
        · PropertyIQ research · Last updated June 2026. PropertyIQ is one of the
        tools ranked below — see our criteria.
      </p>

      <section className="mt-6 rounded-xl border border-outline-variant bg-surface-container-low p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-on-surface-variant">
          How we ranked these tools
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-on-surface-variant">
          {ROUNDUP_CRITERIA}
        </p>
      </section>

      <RankingMatrix />

      <section className="mt-10 space-y-5">
        <h2 className="text-2xl font-medium text-on-surface">
          The ranking, explained
        </h2>
        {tools.map((tool) => (
          <ToolCard key={tool.name} tool={tool} />
        ))}
      </section>

      <MoreComparisons />

      <CallToAction />

      <FaqSection faqs={COMPARE_INDEX_FAQS} />
    </>
  );
}
