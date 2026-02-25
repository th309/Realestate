import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Housing Market Graphs & Trends',
  description: 'Interactive charts and graphs showing housing market trends, price history, inventory levels, and economic indicators across US metros.',
};

export default function GraphsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
