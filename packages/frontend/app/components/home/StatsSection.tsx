'use client';

import { AnimatedCounter } from './AnimatedCounter';

const STATS = [
  { value: 2400000, suffix: '+', label: 'Properties Analyzed' },
  { value: 384, suffix: '', label: 'Metro Areas' },
  { value: 95, suffix: '+', label: 'Data Points per Property' },
];

export function StatsSection() {
  return (
    <section className="grid grid-cols-1 md:grid-cols-3 gap-8 px-6 py-16 bg-surface-container-low border-y border-outline-variant">
      {STATS.map((stat, i) => (
        <div key={i} className="text-center">
          <div className="text-3xl md:text-4xl lg:text-5xl font-bold font-mono text-on-surface">
            <AnimatedCounter end={stat.value} suffix={stat.suffix} />
          </div>
          <div className="text-sm text-on-surface-variant mt-2">{stat.label}</div>
        </div>
      ))}
    </section>
  );
}
