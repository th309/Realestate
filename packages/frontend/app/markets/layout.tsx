import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Housing Markets - Browse 925+ US Metro Areas',
  description:
    'Browse housing market data, scores, and analysis for 925+ US metro areas. Compare home values, trends, and AI-powered market scores by city and state.',
};

export default function MarketsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
