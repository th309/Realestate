import { Target } from 'lucide-react';
import { PageHeaderWithBreadcrumbs } from '@/components/navigation';
import { HeroStats } from './components/HeroStats';
import { DollarImpactSection } from './components/DollarImpactSection';
import { AlphaCallout } from './components/AlphaCallout';
import { InteractiveScatter } from './components/InteractiveScatter';
import { QuintilePerformance } from './components/QuintilePerformance';
import { PearsonVsSpearman } from './components/PearsonVsSpearman';
import { HeadToHead } from './components/HeadToHead';
import { GeographyCoverage } from './components/GeographyCoverage';
import { MethodologyFooter } from './components/MethodologyFooter';
import { CTABanner } from './components/CTABanner';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Forecast Accuracy — PropertyIQ Scores Beat the Competition',
  description:
    'Spearman \u03C1 = 0.80, validated across 24 monthly windows, 860+ metros, 28,000+ markets. See how PropertyIQ Scores predict real-world returns.',
  openGraph: {
    title: 'Forecast Accuracy — PropertyIQ',
    description:
      '0.80 correlation. 24 months. Zero cherry-picking. See the proof behind PropertyIQ Scores.',
  },
};

export default function AccuracyPage() {
  return (
    <div className="mt-12 space-y-16">
      {/* Breadcrumbs */}
      <section>
        <PageHeaderWithBreadcrumbs
          breadcrumbs={[
            { label: 'Scores', href: '/scores' },
            { label: 'Forecast Accuracy' },
          ]}
          title="Forecast Accuracy"
          description="How well do PropertyIQ Scores predict real-world market returns?"
          icon={<Target className="w-5 h-5" />}
        />
      </section>

      {/* 1. Hero Stats */}
      <HeroStats />

      {/* 2. Dollar Impact */}
      <DollarImpactSection />

      {/* 2b. Alpha vs Beta Callout */}
      <AlphaCallout />

      {/* 3. Interactive Scatter */}
      <InteractiveScatter />

      {/* 4. Quintile Performance */}
      <QuintilePerformance />

      {/* 5. Pearson vs Spearman Explainer */}
      <PearsonVsSpearman />

      {/* 6. Head-to-Head Comparison */}
      <HeadToHead />

      {/* 7. Geography Coverage */}
      <GeographyCoverage />

      {/* 9. Methodology */}
      <MethodologyFooter />

      {/* 10. CTA */}
      <CTABanner />
    </div>
  );
}
