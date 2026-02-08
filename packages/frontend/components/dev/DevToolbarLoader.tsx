'use client';

import dynamic from 'next/dynamic';

const DevToolbar = dynamic(
  () => import('./DevToolbar').then(m => ({ default: m.DevToolbar })),
  { ssr: false }
);

export function DevToolbarLoader() {
  return <DevToolbar />;
}
