'use client';

/**
 * Analytics Assistant Test Page
 *
 * Test the natural language analytics interface.
 */

import { AnalyticsAssistantButton, AnalyticsAssistantPanel } from '@/components/analytics-assistant';

export default function TestAnalyticsPage() {
  return (
    <div className="min-h-screen bg-surface">
      {/* Header */}
      <header className="border-b border-outline-variant bg-surface-container-low">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <h1 className="text-2xl font-bold text-on-surface">
            Analytics Assistant Test
          </h1>
          <p className="text-sm text-on-surface-variant mt-1">
            Test the natural language analytics interface
          </p>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Button Variants */}
        <section className="mb-12">
          <h2 className="text-lg font-semibold text-on-surface mb-4">
            Button Variants
          </h2>
          <div className="flex flex-wrap gap-4 items-center">
            <AnalyticsAssistantButton variant="primary" label="Ask AI" />
            <AnalyticsAssistantButton variant="secondary" label="Analyze" />
            <AnalyticsAssistantButton variant="ghost" label="Insights" />
            <AnalyticsAssistantButton iconOnly />
            <AnalyticsAssistantButton size="sm" label="Small" />
            <AnalyticsAssistantButton size="lg" label="Large" />
          </div>
        </section>

        {/* Context-Aware Button */}
        <section className="mb-12">
          <h2 className="text-lg font-semibold text-on-surface mb-4">
            Context-Aware (Scoped to Austin, TX)
          </h2>
          <AnalyticsAssistantButton
            variant="secondary"
            label="Ask about Austin"
            context={{
              geographyType: 'metro',
              geographyId: '12420',
              geographyName: 'Austin-Round Rock-Georgetown, TX',
            }}
            starterPrompts={[
              'How does Austin compare to other Texas metros?',
              'What is the historical performance?',
              'Show me the score trend',
            ]}
          />
        </section>

        {/* Embedded Panel */}
        <section>
          <h2 className="text-lg font-semibold text-on-surface mb-4">
            Embedded Panel
          </h2>
          <div className="border border-outline-variant rounded-2xl overflow-hidden bg-surface h-[600px]">
            <AnalyticsAssistantPanel
              title="Market Analytics"
              subtitle="Ask questions about PropertyIQ market data"
              starterPrompts={[
                'Show me the top 10 metros by InvestorEdge score',
                'Compare Texas to the national average',
                'What markets have the best 3-year correlation?',
                'List bottom 5 performers in California',
              ]}
            />
          </div>
        </section>
      </main>
    </div>
  );
}
