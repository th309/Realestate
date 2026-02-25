import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Interactive Housing Market Map',
  description: 'Explore the interactive housing market heat map. Visualize home values, rent prices, inventory, and 40+ metrics across 925 US metros and 33,000+ ZIP codes.',
};

export default function MapLayout({ children }: { children: React.ReactNode }) {
  return children;
}
