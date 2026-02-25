import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Market Intelligence - Housing Market Rankings',
  description: 'Explore housing market rankings, scores, and analysis for US metros, counties, and ZIP codes. AI-powered market intelligence by PropertyIQ.',
};

export default function MarketLayout({ children }: { children: React.ReactNode }) {
  return children;
}
