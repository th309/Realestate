'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Layers,
  Clock,
  Users,
  BarChart3,
  Zap,
  BookOpen,
} from 'lucide-react';

const NAV_ITEMS = [
  {
    label: 'Overview',
    href: '/_dev/admin/entitlements',
    icon: LayoutDashboard,
  },
  {
    label: 'Configure',
    items: [
      { label: 'Tiers', href: '/_dev/admin/entitlements/tiers', icon: Layers },
      { label: 'Trial', href: '/_dev/admin/entitlements/trial', icon: Clock },
      { label: 'Users', href: '/_dev/admin/entitlements/users', icon: Users },
    ],
  },
  {
    label: 'Insights',
    items: [
      { label: 'Analytics', href: '/_dev/admin/entitlements/analytics', icon: BarChart3 },
    ],
  },
  {
    label: 'Automate',
    items: [
      { label: 'Rules', href: '/_dev/admin/entitlements/automations', icon: Zap },
    ],
  },
  {
    label: 'Learn',
    items: [
      { label: 'Playbook', href: '/_dev/admin/entitlements/playbook', icon: BookOpen },
    ],
  },
];

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 bg-surface-container-low border-r border-outline-variant h-screen sticky top-0 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-outline-variant">
        <h1 className="text-lg font-semibold text-on-surface">Entitlements</h1>
        <p className="text-xs text-on-surface-variant">Admin Dashboard</p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-2">
        {NAV_ITEMS.map((section, idx) => (
          <div key={idx} className="mb-4">
            {'href' in section ? (
              <Link
                href={section.href}
                className={`
                  flex items-center gap-3 px-3 py-2 rounded-lg text-sm
                  ${pathname === section.href
                    ? 'bg-primary/10 text-primary font-medium'
                    : 'text-on-surface-variant hover:bg-surface-container-high'
                  }
                `}
              >
                <section.icon className="w-5 h-5" />
                {section.label}
              </Link>
            ) : (
              <>
                <div className="px-3 py-2 text-xs font-medium text-on-surface-variant uppercase tracking-wider">
                  {section.label}
                </div>
                <div className="space-y-1">
                  {section.items?.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`
                        flex items-center gap-3 px-3 py-2 rounded-lg text-sm
                        ${pathname === item.href
                          ? 'bg-primary/10 text-primary font-medium'
                          : 'text-on-surface-variant hover:bg-surface-container-high'
                        }
                      `}
                    >
                      <item.icon className="w-5 h-5" />
                      {item.label}
                    </Link>
                  ))}
                </div>
              </>
            )}
          </div>
        ))}
      </nav>

      {/* Tier Switcher */}
      <div className="p-4 border-t border-outline-variant">
        <label className="text-xs font-medium text-on-surface-variant block mb-2">
          Simulate Tier
        </label>
        <select className="w-full px-3 py-2 bg-surface-container rounded-lg text-sm border border-outline-variant">
          <option value="">Current Tier</option>
          <option value="free">Free</option>
          <option value="pro">Pro</option>
          <option value="enterprise">Enterprise</option>
        </select>
      </div>
    </aside>
  );
}
