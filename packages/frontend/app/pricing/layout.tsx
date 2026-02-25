import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Pricing - PropertyIQ Plans for Investors, Agents & Homebuyers',
  description: 'Compare PropertyIQ plans: Free, Pro ($29/mo), and Team ($99/mo). AI-powered market analysis, scores, reports, and interactive maps.',
};

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  return children;
}
