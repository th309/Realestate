import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Compare PropertyIQ',
  description:
    'See how PropertyIQ compares to other real estate analytics platforms.',
};

export default function CompareLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {children}
    </div>
  );
}
