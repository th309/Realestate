'use client';

import { use } from 'react';
import { MarketDashboard } from './MarketDashboard';

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ type?: string; view?: string }>;
}

export default function MarketPage({ params, searchParams }: PageProps) {
  const { id } = use(params);
  const { type = 'metro', view = 'investor' } = use(searchParams);

  return (
    <MarketDashboard
      geographyId={id}
      geographyType={type as 'metro' | 'county' | 'zip'}
      userView={view as 'investor' | 'homebuyer'}
    />
  );
}
