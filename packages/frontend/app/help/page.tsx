import { HelpCircle, Mail, MessageSquare, BookOpen, FileText, BarChart3 } from 'lucide-react';
import Link from 'next/link';
import { PageHeaderWithBreadcrumbs } from '@/components/navigation';

interface FaqItem {
  question: string;
  answer: string;
}

const FAQ_ITEMS: FaqItem[] = [
  {
    question: 'What is PropertyIQ?',
    answer:
      'PropertyIQ is an AI-powered real estate analytics platform that helps buyers, investors, and professionals make smarter decisions using data from 925+ metros, 3,100+ counties, and 33,000+ ZIP codes across the US.',
  },
  {
    question: 'Where does the data come from?',
    answer:
      'We aggregate data from trusted public and private sources including Realtor.com, Zillow, US Census Bureau, Bureau of Labor Statistics, Bureau of Economic Analysis, and the Federal Reserve (FRED). Visit our Data Glossary for full details.',
  },
  {
    question: 'How often is data updated?',
    answer:
      'Most metrics are updated monthly as new data becomes available from our sources. Some economic indicators (like unemployment) may have a one-month lag due to reporting schedules.',
  },
  {
    question: 'What are PropertyIQ Scores?',
    answer:
      'PropertyIQ Scores are composite ratings (0–100) that evaluate markets across multiple dimensions—affordability, growth potential, stability, and more. They combine dozens of underlying metrics into a single actionable number.',
  },
  {
    question: 'What is the difference between Free, Pro, and Enterprise plans?',
    answer:
      'Free gives you access to core metrics and national/state/metro data. Pro unlocks all metrics, score breakdowns, extended history, and more reports. Enterprise adds team seat management, unlimited reports, and full API access. Visit our Pricing page for details.',
  },
  {
    question: 'How do I upgrade my plan?',
    answer:
      'Go to Settings > Subscription in your account menu, or visit the Pricing page. You can upgrade, downgrade, or manage your billing at any time.',
  },
  {
    question: 'Can I export or print reports?',
    answer:
      'Yes. Market reports include a print-friendly layout and a share link. Pro and Enterprise users can generate more reports per month.',
  },
];

const RESOURCE_LINKS = [
  { label: 'Data Glossary', href: '/data', icon: BookOpen, description: 'Explore all metrics and data sources' },
  { label: 'Score Methodology', href: '/scores/methodology', icon: BarChart3, description: 'How PropertyIQ Scores are calculated' },
  { label: 'Pricing', href: '/pricing', icon: FileText, description: 'Compare plans and features' },
];

export default function HelpPage() {
  return (
    <div className="min-h-screen bg-surface">
      <div className="max-w-4xl mx-auto px-6 py-8">
        <PageHeaderWithBreadcrumbs
          breadcrumbs={[{ label: 'Help' }]}
          title="Help & FAQ"
          description="Find answers to common questions about PropertyIQ"
          icon={<HelpCircle className="w-5 h-5" />}
        />

        {/* FAQ Section */}
        <div className="mt-12 space-y-6">
          <h2 className="text-xl font-semibold text-on-surface flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-primary" />
            Frequently Asked Questions
          </h2>
          <div className="space-y-4">
            {FAQ_ITEMS.map((item) => (
              <details
                key={item.question}
                className="group rounded-2xl border border-outline-variant bg-surface-container-lowest overflow-hidden"
              >
                <summary className="cursor-pointer px-6 py-4 text-sm font-medium text-on-surface hover:bg-surface-container transition-colors list-none flex items-center justify-between">
                  {item.question}
                  <span className="ml-2 text-on-surface-variant group-open:rotate-180 transition-transform">
                    &#x25BE;
                  </span>
                </summary>
                <div className="px-6 pb-4 text-sm text-on-surface-variant leading-relaxed">
                  {item.answer}
                </div>
              </details>
            ))}
          </div>
        </div>

        {/* Resources Section */}
        <div className="mt-12 space-y-6">
          <h2 className="text-xl font-semibold text-on-surface flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-primary" />
            Resources
          </h2>
          <div className="grid gap-4 sm:grid-cols-3">
            {RESOURCE_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="flex flex-col gap-2 p-5 rounded-2xl border border-outline-variant bg-surface-container-lowest hover:bg-surface-container hover:border-primary/30 transition-colors"
              >
                <link.icon className="w-5 h-5 text-primary" />
                <span className="text-sm font-medium text-on-surface">{link.label}</span>
                <span className="text-xs text-on-surface-variant">{link.description}</span>
              </Link>
            ))}
          </div>
        </div>

        {/* Contact Section */}
        <div className="mt-12 rounded-2xl border border-outline-variant bg-surface-container-lowest p-6">
          <h2 className="text-lg font-semibold text-on-surface flex items-center gap-2 mb-3">
            <Mail className="w-5 h-5 text-primary" />
            Still need help?
          </h2>
          <p className="text-sm text-on-surface-variant">
            Reach out to us at{' '}
            <a href="mailto:support@propertyiq.ai" className="text-primary hover:underline">
              support@propertyiq.ai
            </a>{' '}
            and we&apos;ll get back to you as soon as possible.
          </p>
        </div>
      </div>
    </div>
  );
}
