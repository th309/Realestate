/**
 * Geography Coverage
 *
 * Animated counters showing coverage across geo levels
 * plus a bar chart of correlation by geography.
 * Client component.
 */

'use client';

import { useEffect, useState, useRef } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { MapPin, Building2, Mail } from 'lucide-react';
import { useValidationGeography } from '@/lib/data';

function AnimatedCounter({ end, duration = 1500 }: { end: number; duration?: number }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const hasAnimated = useRef(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasAnimated.current) {
          hasAnimated.current = true;
          const start = performance.now();
          const animate = (now: number) => {
            const elapsed = now - start;
            const progress = Math.min(elapsed / duration, 1);
            // Ease-out cubic
            const eased = 1 - Math.pow(1 - progress, 3);
            setCount(Math.round(eased * end));
            if (progress < 1) requestAnimationFrame(animate);
          };
          requestAnimationFrame(animate);
        }
      },
      { threshold: 0.3 },
    );

    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [end, duration]);

  return (
    <div ref={ref}>
      <span>{count.toLocaleString()}</span>
    </div>
  );
}

const GEO_ICONS = {
  metro: MapPin,
  county: Building2,
  zip: Mail,
};

const GEO_LABELS: Record<string, string> = {
  metro: 'Metro Areas',
  county: 'Counties',
  zip: 'ZIP Codes',
};

export function GeographyCoverage() {
  const { data: rawData, isLoading, error } = useValidationGeography({
    scoreType: 'homeready',
  });

  if (isLoading) {
    return (
      <section>
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-surface-container rounded-2xl p-5 border border-outline-variant">
              <div className="h-8 w-20 bg-outline-variant/30 rounded animate-pulse mb-2" />
              <div className="h-4 w-24 bg-outline-variant/20 rounded animate-pulse" />
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (error || !rawData) {
    return (
      <section>
        <p className="text-sm text-on-surface-variant">Geography data unavailable.</p>
      </section>
    );
  }

  const chartData = rawData.map((g) => ({
    name: GEO_LABELS[g.geographyType] || g.geographyType,
    type: g.geographyType,
    correlation1y: g.avgCorrelation1y,
    correlation3y: g.avgCorrelation3y,
    hitRate: g.avgHitRate1y,
    count: g.totalScores,
  }));

  return (
    <section>
      <p className="text-xs uppercase tracking-[0.2em] font-semibold text-primary">
        Coverage
      </p>
      <h2 className="text-2xl font-[var(--font-source-serif)] text-on-surface mt-2">
        Validated Everywhere, Not Just Big Metros
      </h2>
      <p className="text-on-surface-variant mt-2 max-w-2xl">
        Our model works across all geography levels &mdash; not just the 380 largest metros.
      </p>

      {/* Counter cards */}
      <div className="grid grid-cols-3 gap-4 mt-8">
        {rawData.map((g) => {
          const Icon = GEO_ICONS[g.geographyType] || MapPin;
          return (
            <div
              key={g.geographyType}
              className="bg-surface-container rounded-2xl p-5 border border-outline-variant text-center"
            >
              <div className="p-2 bg-primary-container rounded-xl text-on-primary-container w-fit mx-auto">
                <Icon className="w-5 h-5" />
              </div>
              <div className="text-3xl font-bold text-on-surface mt-3">
                <AnimatedCounter end={g.totalScores} />
              </div>
              <p className="text-sm text-on-surface-variant mt-1">
                {GEO_LABELS[g.geographyType] || g.geographyType}
              </p>
              <p className="text-xs text-on-surface-variant/70 mt-0.5">
                r = {g.avgCorrelation1y.toFixed(2)} (1Y)
              </p>
            </div>
          );
        })}
      </div>

      {/* Correlation comparison */}
      <div className="mt-6 bg-surface-container-low border border-outline-variant rounded-2xl p-4">
        <h3 className="text-sm font-semibold text-on-surface mb-4">
          Correlation by Geography Level
        </h3>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--outline-variant)" opacity={0.5} />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 11, fill: 'var(--on-surface-variant)' }}
                tickLine={false}
                axisLine={{ stroke: 'var(--outline-variant)' }}
              />
              <YAxis
                tick={{ fontSize: 11, fill: 'var(--on-surface-variant)' }}
                tickLine={false}
                axisLine={{ stroke: 'var(--outline-variant)' }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'var(--surface-container)',
                  border: '1px solid var(--outline-variant)',
                  borderRadius: '8px',
                  fontSize: '12px',
                }}
                formatter={(value: number, name: string) => [
                  value.toFixed(3),
                  name === 'correlation1y' ? '1-Year Corr' : '3-Year Corr',
                ]}
              />
              <Bar dataKey="correlation1y" name="1-Year" fill="var(--primary)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="correlation3y" name="3-Year" fill="var(--secondary)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-2 flex justify-center gap-6 text-xs text-on-surface-variant">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-[var(--primary)]" />
            <span>1-Year Correlation</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-[var(--secondary)]" />
            <span>3-Year Correlation</span>
          </div>
        </div>
      </div>
    </section>
  );
}
