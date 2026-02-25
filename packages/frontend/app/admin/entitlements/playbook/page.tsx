'use client';

import React, { useState } from 'react';
import {
  BookOpen,
  ChevronRight,
  CheckCircle,
  Target,
  TrendingUp,
  Users,
  Zap,
  DollarSign,
  Gift,
  BarChart3,
  Lightbulb,
  ExternalLink,
} from 'lucide-react';

// Types
interface PlaybookSection {
  id: string;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  content: PlaybookContent[];
}

interface PlaybookContent {
  type: 'heading' | 'paragraph' | 'list' | 'tip' | 'metric' | 'action';
  content: string | string[];
  title?: string;
}

// Playbook content
const PLAYBOOK_SECTIONS: PlaybookSection[] = [
  {
    id: 'tier-strategy',
    title: 'Tier Strategy',
    icon: Target,
    description: 'Design tiers that maximize conversions while providing value at every level',
    content: [
      {
        type: 'heading',
        content: 'The Golden Rule of Tiering',
      },
      {
        type: 'paragraph',
        content: 'Your free tier should be valuable enough to attract users, but limited enough to create natural upgrade moments. Think of it as a "taste" of your product, not a "meal".',
      },
      {
        type: 'list',
        title: 'Free Tier Best Practices',
        content: [
          'Include 3-5 core features that solve a real problem',
          'Limit geography to state/metro level (where users discover value)',
          'Allow full access to 1-2 premium features as a preview',
          'Set reasonable rate limits rather than hard blocks',
        ],
      },
      {
        type: 'tip',
        content: 'Users who use 3+ features in their first week are 4x more likely to convert. Focus on activation, not restriction.',
      },
      {
        type: 'list',
        title: 'Pro Tier Positioning',
        content: [
          'Unlock all core metrics and most geographies',
          'Position as the "professional" choice for serious users',
          'Include convenience features (CSV export, saved searches)',
          'Price at a point that feels like "obvious value"',
        ],
      },
    ],
  },
  {
    id: 'paywall-design',
    title: 'Paywall Design',
    icon: DollarSign,
    description: 'Create paywalls that convert without frustrating users',
    content: [
      {
        type: 'heading',
        content: 'Paywall Psychology',
      },
      {
        type: 'paragraph',
        content: 'The best paywalls feel like helpful suggestions, not barriers. They appear at moments of high intent and clearly articulate the value being offered.',
      },
      {
        type: 'list',
        title: 'High-Converting Paywall Patterns',
        content: [
          'Show a preview/teaser of the locked content (blur effect)',
          'Explain WHY this feature is valuable, not just that it\'s locked',
          'Include social proof ("12,000 Pro users love this feature")',
          'Offer a trial CTA alongside the purchase CTA',
        ],
      },
      {
        type: 'metric',
        title: 'Benchmark CTRs',
        content: [
          'Inline paywall cards: 5-8% CTR',
          'Full-page overlays: 2-4% CTR',
          'Teaser/preview with blur: 8-12% CTR',
          'Contextual nudges: 3-5% CTR',
        ],
      },
      {
        type: 'tip',
        content: 'A/B test your paywall copy. "Unlock detailed analytics" converts 23% better than "Upgrade to Pro" in our data.',
      },
    ],
  },
  {
    id: 'trial-optimization',
    title: 'Trial Optimization',
    icon: Gift,
    description: 'Run trials that convert free users into paying customers',
    content: [
      {
        type: 'heading',
        content: 'Trial Length Matters',
      },
      {
        type: 'metric',
        title: 'Trial Length vs Conversion',
        content: [
          '7-day trial: 18% conversion rate',
          '14-day trial: 24% conversion rate',
          '30-day trial: 21% conversion rate',
        ],
      },
      {
        type: 'paragraph',
        content: '14 days is the sweet spot. Long enough for users to form habits, short enough to create urgency.',
      },
      {
        type: 'list',
        title: 'Trial Onboarding Checklist',
        content: [
          'Send welcome email within 1 hour of trial start',
          'Highlight 3 "must-try" premium features',
          'Schedule check-in at day 7 with usage summary',
          'Send reminder emails at days 7, 3, and 1',
          'Offer extension to high-engagement users who don\'t convert',
        ],
      },
      {
        type: 'action',
        content: 'Set up trial reminder automations →',
      },
    ],
  },
  {
    id: 'conversion-tactics',
    title: 'Conversion Tactics',
    icon: TrendingUp,
    description: 'Proven strategies to turn free users into paying customers',
    content: [
      {
        type: 'heading',
        content: 'The Conversion Funnel',
      },
      {
        type: 'list',
        title: 'Stage 1: Awareness',
        content: [
          'Show upgrade benefits in natural workflow moments',
          'Use "Pro" badges on premium features',
          'Display tier comparison on profile page',
        ],
      },
      {
        type: 'list',
        title: 'Stage 2: Consideration',
        content: [
          'Offer free trial when users hit multiple paywalls',
          'Send personalized upgrade emails based on usage',
          'Show testimonials from similar users',
        ],
      },
      {
        type: 'list',
        title: 'Stage 3: Decision',
        content: [
          'Offer time-limited discounts to high-intent users',
          'Provide annual billing discount (typically 20%)',
          'Remove friction from checkout (fewer steps = higher conversion)',
        ],
      },
      {
        type: 'tip',
        content: 'Users who hit 5+ paywalls in a single session have 3x higher conversion rate. Target them with special offers.',
      },
    ],
  },
  {
    id: 'retention-playbook',
    title: 'Retention Playbook',
    icon: Users,
    description: 'Keep paying customers engaged and prevent churn',
    content: [
      {
        type: 'heading',
        content: 'Churn Prevention',
      },
      {
        type: 'paragraph',
        content: 'It costs 5x more to acquire a new customer than to retain an existing one. Focus on keeping your paying users happy.',
      },
      {
        type: 'list',
        title: 'Early Warning Signs',
        content: [
          'No login for 14+ days',
          'Decreased feature usage (vs previous month)',
          'Support tickets or complaints',
          'Failed payment attempts',
        ],
      },
      {
        type: 'list',
        title: 'Retention Tactics',
        content: [
          'Send "We miss you" email after 14 days inactive',
          'Offer temporary tier upgrade to re-engage churning users',
          'Create exclusive content/features for Pro users',
          'Build habit loops (daily/weekly reports, notifications)',
        ],
      },
      {
        type: 'action',
        content: 'Create churn risk automation →',
      },
    ],
  },
  {
    id: 'analytics-guide',
    title: 'Analytics Guide',
    icon: BarChart3,
    description: 'Understand your metrics and make data-driven decisions',
    content: [
      {
        type: 'heading',
        content: 'Key Metrics to Track',
      },
      {
        type: 'list',
        title: 'Conversion Metrics',
        content: [
          'Free-to-trial conversion rate (target: 8-12%)',
          'Trial-to-paid conversion rate (target: 20-30%)',
          'Paywall click-through rate (target: 5-10%)',
          'Average time to conversion (track weekly)',
        ],
      },
      {
        type: 'list',
        title: 'Engagement Metrics',
        content: [
          'Feature adoption rate by tier',
          'Session frequency and duration',
          'Paywall hit frequency per user',
          'Most-blocked features (upgrade drivers)',
        ],
      },
      {
        type: 'list',
        title: 'Revenue Metrics',
        content: [
          'Monthly Recurring Revenue (MRR)',
          'Average Revenue Per User (ARPU)',
          'Customer Lifetime Value (LTV)',
          'Churn rate (target: <5% monthly)',
        ],
      },
      {
        type: 'action',
        content: 'View your analytics dashboard →',
      },
    ],
  },
];

// Components
function ContentRenderer({ content }: { content: PlaybookContent }) {
  switch (content.type) {
    case 'heading':
      return (
        <h3 className="text-lg font-semibold text-on-surface mt-6 mb-3">
          {content.content}
        </h3>
      );
    case 'paragraph':
      return (
        <p className="text-on-surface-variant leading-relaxed mb-4">
          {content.content}
        </p>
      );
    case 'list':
      return (
        <div className="mb-4">
          {content.title && (
            <h4 className="text-sm font-medium text-on-surface mb-2">
              {content.title}
            </h4>
          )}
          <ul className="space-y-2">
            {(content.content as string[]).map((item, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-on-surface-variant">
                <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      );
    case 'tip':
      return (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
          <div className="flex items-start gap-3">
            <Lightbulb className="w-5 h-5 text-amber-600 flex-shrink-0" />
            <p className="text-sm text-amber-800">{content.content}</p>
          </div>
        </div>
      );
    case 'metric':
      return (
        <div className="bg-surface-container-high rounded-lg p-4 mb-4">
          {content.title && (
            <h4 className="text-sm font-medium text-on-surface mb-2">
              {content.title}
            </h4>
          )}
          <div className="space-y-1">
            {(content.content as string[]).map((item, i) => (
              <div key={i} className="text-sm text-on-surface-variant">
                {item}
              </div>
            ))}
          </div>
        </div>
      );
    case 'action':
      return (
        <button className="flex items-center gap-2 text-sm text-primary hover:underline mt-2">
          {content.content}
          <ExternalLink className="w-4 h-4" />
        </button>
      );
    default:
      return null;
  }
}

function PlaybookCard({
  section,
  isExpanded,
  onToggle,
}: {
  section: PlaybookSection;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const Icon = section.icon;

  return (
    <div className="bg-surface-container rounded-xl border border-outline-variant overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-4 p-5 text-left hover:bg-surface-container-high transition-colors"
      >
        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
          <Icon className="w-6 h-6 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-on-surface">{section.title}</h3>
          <p className="text-sm text-on-surface-variant line-clamp-1">
            {section.description}
          </p>
        </div>
        <ChevronRight
          className={`w-5 h-5 text-on-surface-variant transition-transform ${
            isExpanded ? 'rotate-90' : ''
          }`}
        />
      </button>

      {isExpanded && (
        <div className="px-5 pb-5 border-t border-outline-variant pt-4">
          {section.content.map((content, i) => (
            <ContentRenderer key={i} content={content} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function PlaybookPage() {
  const [expandedSection, setExpandedSection] = useState<string | null>('tier-strategy');

  return (
    <div className="max-w-3xl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <BookOpen className="w-5 h-5 text-primary" />
          </div>
          <h1 className="text-2xl font-semibold text-on-surface">
            Entitlements Playbook
          </h1>
        </div>
        <p className="text-on-surface-variant">
          Best practices and strategies for maximizing conversion and retention
          through your entitlements system.
        </p>
      </div>

      {/* Quick Stats */}
      <div className="bg-gradient-to-r from-primary/5 to-primary/10 rounded-xl p-6 mb-8 border border-primary/20">
        <h2 className="text-lg font-medium text-on-surface mb-4">
          Your Quick Stats
        </h2>
        <div className="grid grid-cols-3 gap-6">
          <div>
            <div className="text-3xl font-bold text-primary">24%</div>
            <div className="text-sm text-on-surface-variant">
              Trial Conversion
            </div>
            <div className="text-xs text-green-600">+5% vs benchmark</div>
          </div>
          <div>
            <div className="text-3xl font-bold text-primary">9.6%</div>
            <div className="text-sm text-on-surface-variant">Paywall CTR</div>
            <div className="text-xs text-amber-600">At benchmark</div>
          </div>
          <div>
            <div className="text-3xl font-bold text-primary">3.2%</div>
            <div className="text-sm text-on-surface-variant">Churn Rate</div>
            <div className="text-xs text-green-600">-1.8% vs benchmark</div>
          </div>
        </div>
      </div>

      {/* Table of Contents */}
      <div className="bg-surface-container rounded-xl p-5 mb-8">
        <h2 className="text-sm font-medium text-on-surface-variant uppercase tracking-wider mb-3">
          Contents
        </h2>
        <div className="grid grid-cols-2 gap-2">
          {PLAYBOOK_SECTIONS.map((section) => {
            const Icon = section.icon;
            return (
              <button
                key={section.id}
                onClick={() => setExpandedSection(section.id)}
                className={`
                  flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-left transition-colors
                  ${expandedSection === section.id
                    ? 'bg-primary/10 text-primary'
                    : 'hover:bg-surface-container-high text-on-surface-variant'
                  }
                `}
              >
                <Icon className="w-4 h-4" />
                {section.title}
              </button>
            );
          })}
        </div>
      </div>

      {/* Playbook Sections */}
      <div className="space-y-4">
        {PLAYBOOK_SECTIONS.map((section) => (
          <PlaybookCard
            key={section.id}
            section={section}
            isExpanded={expandedSection === section.id}
            onToggle={() =>
              setExpandedSection(
                expandedSection === section.id ? null : section.id
              )
            }
          />
        ))}
      </div>

      {/* Footer CTA */}
      <div className="mt-8 text-center">
        <p className="text-on-surface-variant mb-4">
          Have questions about optimizing your entitlements strategy?
        </p>
        <a
          href="mailto:support@propertyiq.app"
          className="inline-flex items-center gap-2 text-primary hover:underline"
        >
          Contact our team
          <ExternalLink className="w-4 h-4" />
        </a>
      </div>
    </div>
  );
}
