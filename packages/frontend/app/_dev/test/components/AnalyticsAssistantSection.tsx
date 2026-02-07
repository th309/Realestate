/**
 * Analytics Assistant Test Section
 *
 * Test the natural language analytics interface components.
 * Merged from /test-analytics page.
 */

'use client';

import { AnalyticsAssistantButton, AnalyticsAssistantPanel } from '@/components/analytics-assistant';

export function AnalyticsAssistantSection() {
  return (
    <div className="space-y-8">
      {/* Button Variants */}
      <section className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
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
      <section className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
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
      <section className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Embedded Panel
        </h2>
        <div className="border border-gray-200 rounded-xl overflow-hidden h-[500px]">
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
    </div>
  );
}
