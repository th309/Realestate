'use client';

import React from 'react';
import { ArrowUpRight, Users, DollarSign, TrendingUp } from 'lucide-react';

function StatCard({
  label,
  value,
  change,
  icon: Icon,
}: {
  label: string;
  value: string;
  change?: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="bg-surface-container rounded-xl p-6">
      <div className="flex items-start justify-between mb-4">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <Icon className="w-5 h-5 text-primary" />
        </div>
        {change && (
          <span className="text-xs text-green-600 bg-green-100 px-2 py-0.5 rounded-full">
            {change}
          </span>
        )}
      </div>
      <div className="text-2xl font-semibold text-on-surface">{value}</div>
      <div className="text-sm text-on-surface-variant">{label}</div>
    </div>
  );
}

export default function EntitlementsOverviewPage() {
  return (
    <div className="max-w-6xl">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-on-surface">Overview</h1>
        <p className="text-on-surface-variant">
          Monitor entitlements, conversions, and user behavior
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <StatCard
          label="Paywall Hits"
          value="4,231"
          change="+18%"
          icon={TrendingUp}
        />
        <StatCard
          label="Conversions"
          value="187"
          change="+4.4%"
          icon={DollarSign}
        />
        <StatCard
          label="Active Users"
          value="892"
          change="+12%"
          icon={Users}
        />
      </div>

      {/* Action Items */}
      <div className="bg-surface-container rounded-xl p-6 mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-medium text-on-surface">Action Items</h2>
          <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
            3 new
          </span>
        </div>
        <div className="space-y-3">
          {[
            'High-intent user needs attention',
            '3 Pro users at churn risk',
            '"rental_yield" should be teaser',
          ].map((item, i) => (
            <div
              key={i}
              className="flex items-center justify-between p-3 bg-surface-container-high rounded-lg"
            >
              <span className="text-sm text-on-surface">{item}</span>
              <div className="flex gap-2">
                <button className="text-xs text-primary hover:underline">View</button>
                <button className="text-xs text-on-surface-variant hover:underline">
                  Dismiss
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: 'Configure Tiers', href: '/_dev/admin/entitlements/tiers' },
          { label: 'View Analytics', href: '/_dev/admin/entitlements/analytics' },
          { label: 'Manage Users', href: '/_dev/admin/entitlements/users' },
        ].map((link) => (
          <a
            key={link.href}
            href={link.href}
            className="
              flex items-center justify-between p-4
              bg-surface-container rounded-xl
              hover:bg-surface-container-high transition-colors
            "
          >
            <span className="text-sm font-medium text-on-surface">{link.label}</span>
            <ArrowUpRight className="w-4 h-4 text-on-surface-variant" />
          </a>
        ))}
      </div>
    </div>
  );
}
