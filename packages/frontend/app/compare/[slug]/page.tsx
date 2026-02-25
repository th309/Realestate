import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import Link from 'next/link';
import {
  COMPARISONS,
  getComparison,
  type ComparisonData,
  type ComparisonWinner,
} from '@/lib/data/comparisons';

// ---------------------------------------------------------------------------
// Static params & metadata
// ---------------------------------------------------------------------------

interface ComparisonPageProps {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams() {
  return COMPARISONS.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({
  params,
}: ComparisonPageProps): Promise<Metadata> {
  const { slug } = await params;
  const comparison = getComparison(slug);

  if (!comparison) {
    return { title: 'Comparison Not Found' };
  }

  return {
    title: comparison.title,
    description: comparison.description,
    openGraph: {
      title: comparison.title,
      description: comparison.description,
    },
  };
}

// ---------------------------------------------------------------------------
// Helper: winner cell styling
// ---------------------------------------------------------------------------

function winnerCellClass(
  column: 'propertyiq' | 'competitor',
  winner: ComparisonWinner,
): string {
  if (winner === column) {
    return 'bg-green-500/10 text-on-surface font-semibold';
  }
  return 'text-on-surface-variant';
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function Breadcrumb({ comparison }: { comparison: ComparisonData }) {
  return (
    <nav
      aria-label="Breadcrumb"
      className="flex items-center gap-1.5 text-sm text-on-surface-variant mb-6"
    >
      <Link href="/" className="hover:text-primary transition-colors">
        Home
      </Link>
      <span aria-hidden="true">/</span>
      <span className="text-on-surface font-medium">{comparison.title}</span>
    </nav>
  );
}

function FeatureComparisonTable({
  comparison,
}: {
  comparison: ComparisonData;
}) {
  return (
    <section className="mt-10">
      <h2 className="text-2xl font-medium text-on-surface mb-4">
        Feature Comparison
      </h2>

      <div className="overflow-x-auto rounded-xl border border-outline-variant">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-surface-container-low text-on-surface">
              <th className="text-left px-4 py-3 font-medium">Feature</th>
              <th className="text-left px-4 py-3 font-medium">PropertyIQ</th>
              <th className="text-left px-4 py-3 font-medium">
                {comparison.competitorName}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant">
            {comparison.features.map((row) => (
              <tr key={row.feature}>
                <td className="px-4 py-3 text-on-surface font-medium">
                  {row.feature}
                </td>
                <td
                  className={`px-4 py-3 ${winnerCellClass('propertyiq', row.winner)}`}
                >
                  {row.propertyiq}
                  {row.winner === 'propertyiq' && (
                    <WinnerBadge />
                  )}
                </td>
                <td
                  className={`px-4 py-3 ${winnerCellClass('competitor', row.winner)}`}
                >
                  {row.competitor}
                  {row.winner === 'competitor' && (
                    <WinnerBadge />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function WinnerBadge() {
  return (
    <span className="ml-2 inline-block rounded-full bg-green-500/20 text-green-700 dark:text-green-400 text-xs font-semibold px-2 py-0.5">
      Winner
    </span>
  );
}

function PricingComparisonTable({
  comparison,
}: {
  comparison: ComparisonData;
}) {
  return (
    <section className="mt-10">
      <h2 className="text-2xl font-medium text-on-surface mb-4">
        Pricing Comparison
      </h2>

      <div className="overflow-x-auto rounded-xl border border-outline-variant">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-surface-container-low text-on-surface">
              <th className="text-left px-4 py-3 font-medium">Tier</th>
              <th className="text-left px-4 py-3 font-medium">PropertyIQ</th>
              <th className="text-left px-4 py-3 font-medium">
                {comparison.competitorName}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant">
            {comparison.pricing.map((row) => (
              <tr key={row.tier}>
                <td className="px-4 py-3 text-on-surface font-medium">
                  {row.tier}
                </td>
                <td className="px-4 py-3 text-on-surface">{row.propertyiq}</td>
                <td className="px-4 py-3 text-on-surface-variant">
                  {row.competitor}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function SummarySection({ summary }: { summary: string }) {
  return (
    <section className="mt-10">
      <h2 className="text-2xl font-medium text-on-surface mb-4">Summary</h2>
      <p className="text-on-surface-variant leading-relaxed">{summary}</p>
    </section>
  );
}

function CallToAction() {
  return (
    <section className="mt-12 text-center">
      <Link
        href="/pricing"
        className="inline-flex items-center gap-2 rounded-full bg-primary px-8 py-3 text-sm font-medium text-on-primary hover:bg-primary/90 transition-colors duration-200"
      >
        Try PropertyIQ Free
      </Link>
    </section>
  );
}

// ---------------------------------------------------------------------------
// FAQ JSON-LD
// ---------------------------------------------------------------------------

function buildFaqJsonLd(comparison: ComparisonData) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: comparison.faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  };
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function ComparisonPage({
  params,
}: ComparisonPageProps) {
  const { slug } = await params;
  const comparison = getComparison(slug);

  if (!comparison) {
    notFound();
  }

  const faqJsonLd = buildFaqJsonLd(comparison);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

      <Breadcrumb comparison={comparison} />

      <h1 className="text-3xl font-medium text-on-surface tracking-tight">
        {comparison.title}
      </h1>

      <p className="mt-3 text-on-surface-variant leading-relaxed">
        {comparison.description}
      </p>

      <FeatureComparisonTable comparison={comparison} />
      <PricingComparisonTable comparison={comparison} />
      <SummarySection summary={comparison.summary} />
      <CallToAction />
    </>
  );
}
