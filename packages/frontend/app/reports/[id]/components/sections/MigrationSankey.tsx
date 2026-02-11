'use client';

import React from 'react';
import { SectionProps } from '../types';
import { formatMetricValue } from '@/lib/data';
import { ArrowRight, ArrowLeft, Users } from 'lucide-react';

export function MigrationSankey({ section, report }: SectionProps) {
  const migration = report.populated_data?.migration;

  if (!migration) {
    return (
      <div className="bg-surface-container rounded-2xl p-6">
        <h3 className="text-lg font-semibold text-on-surface mb-4">Migration Patterns</h3>
        <p className="text-on-surface-variant text-center py-4">Migration data not available</p>
      </div>
    );
  }

  const netMigration = migration.net_migration;
  const isPositive = netMigration > 0;

  return (
    <div className="bg-surface-container rounded-2xl p-6">
      <h3 className="text-lg font-semibold text-on-surface mb-4 flex items-center gap-2">
        <Users className="w-5 h-5 text-primary" />
        Migration Patterns
      </h3>

      {/* Net Migration Summary */}
      <div className={`p-4 rounded-xl mb-6 ${isPositive ? 'bg-green-100' : 'bg-red-100'}`}>
        <p className="text-center">
          <span className={`text-2xl font-bold ${isPositive ? 'text-green-700' : 'text-red-700'}`}>
            {isPositive ? '+' : ''}{netMigration.toLocaleString()}
          </span>
          <span className={`block text-sm ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
            Net Migration (Annual)
          </span>
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Inflows */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <ArrowRight className="w-4 h-4 text-green-600" />
            <span className="font-semibold text-on-surface">Moving In From</span>
          </div>
          <div className="space-y-2">
            {(migration.origins || []).slice(0, 5).map((origin, index) => (
              <div key={origin.geography.id || index} className="flex items-center justify-between p-2 bg-surface rounded-lg">
                <span className="text-on-surface">{origin.geography.name}</span>
                <span className="font-medium text-green-600">+{origin.count.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Outflows */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <ArrowLeft className="w-4 h-4 text-red-600" />
            <span className="font-semibold text-on-surface">Moving Out To</span>
          </div>
          <div className="space-y-2">
            {(migration.destinations || []).slice(0, 5).map((dest, index) => (
              <div key={dest.geography.id || index} className="flex items-center justify-between p-2 bg-surface rounded-lg">
                <span className="text-on-surface">{dest.geography.name}</span>
                <span className="font-medium text-red-600">-{dest.count.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
