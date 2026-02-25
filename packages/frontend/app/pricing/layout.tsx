import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Pricing - PropertyIQ Plans for Investors, Agents & Homebuyers',
  description: 'Compare PropertyIQ plans: Free, Pro, and Enterprise. AI-powered market analysis, scores, reports, and interactive maps for real estate investors.',
};

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  return children;
}
