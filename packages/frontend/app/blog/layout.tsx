import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Blog - Housing Market Insights & Analysis | PropertyIQ',
  description:
    'Data-driven housing market analysis, forecasts, and investment insights from PropertyIQ Research.',
};

export default function BlogLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {children}
    </div>
  );
}
