import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getMetricDefinition, METRIC_DEFINITIONS } from '@/app/map/data/metricDefinitions';
import { METRICS, DATA_DATES, getMetricDataDate, formatDataDateForDisplay } from '@/lib/data';

interface MetricPageProps {
  params: Promise<{ metricId: string }>;
}

// Generate static params for all metrics
export function generateStaticParams() {
  return Object.keys(METRIC_DEFINITIONS).map((metricId) => ({
    metricId,
  }));
}

// Generate metadata for SEO
export async function generateMetadata({ params }: MetricPageProps): Promise<Metadata> {
  const { metricId } = await params;
  const metricDef = getMetricDefinition(metricId);

  if (!metricDef) {
    return {
      title: 'Metric Not Found | PropertyIQ',
    };
  }

  return {
    title: `${metricDef.name} | PropertyIQ Metrics`,
    description: metricDef.description,
  };
}

// Helper to get source URL from data source name
function getDefaultSourceUrl(dataSource: string): string | undefined {
  const sources: Record<string, string | undefined> = {
    'Realtor.com': 'https://www.realtor.com/research/data/',
    'Zillow': 'https://www.zillow.com/research/data/',
    'Zillow ZHVF': 'https://www.zillow.com/research/data/',
    'Zillow ZORI': 'https://www.zillow.com/research/data/',
    'U.S. Census Bureau': 'https://www.census.gov/',
    'U.S. Census Bureau ACS': 'https://www.census.gov/programs-surveys/acs',
    'Bureau of Labor Statistics': 'https://www.bls.gov/',
    'Bureau of Economic Analysis': 'https://www.bea.gov/',
    'FRED': 'https://fred.stlouisfed.org/',
    'Calculated': undefined,
    'PropertyIQ Calculated': undefined,
  };
  return sources[dataSource];
}

// Helper to get supported geos for a metric
function getSupportedGeos(metricId: string): string[] {
  const metricConfig = METRICS[metricId];
  if (metricConfig?.supportedGeos) {
    return metricConfig.supportedGeos.map(geo => {
      const labels: Record<string, string> = {
        national: 'National',
        state: 'State',
        metro: 'Metro Area',
        county: 'County',
        city: 'City',
        zip: 'ZIP Code',
        tract: 'Census Tract',
      };
      return labels[geo] || geo;
    });
  }
  return [];
}

export default async function MetricDetailPage({ params }: MetricPageProps) {
  const { metricId } = await params;
  const metricDef = getMetricDefinition(metricId);

  if (!metricDef) {
    notFound();
  }

  const supportedGeos = getSupportedGeos(metricId);
  const dataAsOf = formatDataDateForDisplay(getMetricDataDate(metricId));
  const sourceUrl = metricDef.sourceUrl || getDefaultSourceUrl(metricDef.dataSource);
  const relatedMetrics = metricDef.relatedMetrics
    ?.map(id => getMetricDefinition(id))
    .filter(Boolean);

  return (
    <main className="min-h-screen bg-surface">
      <div className="max-w-4xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {/* Breadcrumb */}
        <nav className="mb-6" aria-label="Breadcrumb">
          <ol className="flex items-center gap-2 text-sm text-on-surface-variant">
            <li>
              <Link href="/" className="hover:text-primary transition-colors">
                Home
              </Link>
            </li>
            <li>/</li>
            <li>
              <Link href="/map" className="hover:text-primary transition-colors">
                Map
              </Link>
            </li>
            <li>/</li>
            <li className="text-on-surface font-medium">{metricDef.name}</li>
          </ol>
        </nav>

        {/* Header */}
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-on-surface mb-2">
            {metricDef.name}
          </h1>
          <div className="flex flex-wrap gap-2 text-sm text-on-surface-variant">
            <span className="inline-flex items-center px-2 py-1 bg-surface-container rounded-full">
              Source: {metricDef.dataSource}
            </span>
            <span className="inline-flex items-center px-2 py-1 bg-surface-container rounded-full">
              Updates: {metricDef.updateFrequency}
            </span>
            <span className="inline-flex items-center px-2 py-1 bg-surface-container rounded-full">
              Data as of: {dataAsOf}
            </span>
          </div>
        </header>

        {/* Content Sections */}
        <div className="space-y-8">
          {/* Description */}
          <section className="bg-surface-container-low rounded-2xl p-6 elevation-1">
            <h2 className="text-lg font-semibold text-on-surface mb-3">
              Description
            </h2>
            <p className="text-on-surface-variant leading-relaxed">
              {metricDef.description}
            </p>
          </section>

          {/* Formula (if applicable) */}
          {metricDef.formula && (
            <section className="bg-surface-container-low rounded-2xl p-6 elevation-1">
              <h2 className="text-lg font-semibold text-on-surface mb-3">
                Formula
              </h2>
              <div className="bg-surface-container p-4 rounded-lg font-mono text-sm text-on-surface-variant">
                {metricDef.formula}
              </div>
            </section>
          )}

          {/* Data Source & Attribution */}
          <section className="bg-surface-container-low rounded-2xl p-6 elevation-1">
            <h2 className="text-lg font-semibold text-on-surface mb-3">
              Data Source
            </h2>
            <div className="space-y-3">
              <p className="text-on-surface-variant">
                <span className="font-medium text-on-surface">Provider:</span>{' '}
                {metricDef.dataSource}
              </p>
              {sourceUrl && (
                <p className="text-on-surface-variant">
                  <span className="font-medium text-on-surface">Source URL:</span>{' '}
                  <a
                    href={sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    {sourceUrl}
                  </a>
                </p>
              )}
              {metricDef.methodology && (
                <p className="text-on-surface-variant">
                  <span className="font-medium text-on-surface">Methodology:</span>{' '}
                  <a
                    href={metricDef.methodology}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    View methodology documentation
                  </a>
                </p>
              )}
              <p className="text-on-surface-variant">
                <span className="font-medium text-on-surface">Update Frequency:</span>{' '}
                {metricDef.updateFrequency}
              </p>
              <p className="text-on-surface-variant">
                <span className="font-medium text-on-surface">Data As Of:</span>{' '}
                {dataAsOf}
              </p>
            </div>
          </section>

          {/* Supported Geographies */}
          {supportedGeos.length > 0 && (
            <section className="bg-surface-container-low rounded-2xl p-6 elevation-1">
              <h2 className="text-lg font-semibold text-on-surface mb-3">
                Supported Geographies
              </h2>
              <p className="text-on-surface-variant mb-3">
                This metric is available for the following geography levels:
              </p>
              <div className="flex flex-wrap gap-2">
                {supportedGeos.map((geo) => (
                  <span
                    key={geo}
                    className="inline-flex items-center px-3 py-1.5 bg-primary-container text-on-primary-container rounded-full text-sm font-medium"
                  >
                    {geo}
                  </span>
                ))}
              </div>
            </section>
          )}

          {/* Notes/Caveats */}
          {metricDef.notes && (
            <section className="bg-tertiary-container/30 rounded-2xl p-6 border border-tertiary/20">
              <h2 className="text-lg font-semibold text-on-surface mb-3 flex items-center gap-2">
                <svg className="w-5 h-5 text-tertiary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Notes & Caveats
              </h2>
              <p className="text-on-surface-variant leading-relaxed">
                {metricDef.notes}
              </p>
            </section>
          )}

          {/* Related Metrics */}
          {relatedMetrics && relatedMetrics.length > 0 && (
            <section className="bg-surface-container-low rounded-2xl p-6 elevation-1">
              <h2 className="text-lg font-semibold text-on-surface mb-3">
                Related Metrics
              </h2>
              <p className="text-on-surface-variant mb-4">
                You might also find these metrics useful:
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                {relatedMetrics.map((related) => related && (
                  <Link
                    key={related.id}
                    href={`/metrics/${related.id}`}
                    className="flex flex-col p-4 bg-surface-container rounded-xl hover:bg-surface-container-high transition-colors group"
                  >
                    <span className="font-medium text-on-surface group-hover:text-primary transition-colors">
                      {related.name}
                    </span>
                    <span className="text-sm text-on-surface-variant line-clamp-2 mt-1">
                      {related.description.length > 100
                        ? related.description.substring(0, 100) + '...'
                        : related.description}
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Back to Map CTA */}
          <div className="flex justify-center pt-4">
            <Link
              href={`/map?metric=${metricId}`}
              className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-on-primary rounded-full font-medium hover:bg-primary/90 transition-colors elevation-2"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
              </svg>
              View on Map
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
