import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Data Sources',
  description:
    'Learn about the data sources powering PropertyIQ market analytics, including Zillow, Realtor.com, U.S. Census Bureau, and more.',
};

export default function DataLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-surface">
      <div className="max-w-5xl mx-auto px-6 py-8">
        {children}
      </div>
    </div>
  );
}
