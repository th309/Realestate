'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Database,
  Target,
  Cpu,
  CheckCircle2,
  Shield,
  MessageSquare,
  ArrowLeft,
  Menu,
  X,
} from 'lucide-react';

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  exactMatch?: boolean;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    title: 'Monitor',
    items: [
      { label: 'Dashboard', href: '/admin', icon: LayoutDashboard, exactMatch: true },
      { label: 'Data Feeds', href: '/admin/data', icon: Database },
      { label: 'Scores', href: '/admin/propertyiq-scores', icon: Target },
      { label: 'ML Ops', href: '/admin/ml-workflow', icon: Cpu },
      { label: 'Validation', href: '/admin/score-validation', icon: CheckCircle2 },
    ],
  },
  {
    title: 'Manage',
    items: [
      { label: 'Entitlements', href: '/admin/entitlements', icon: Shield },
      { label: 'Feedback', href: '/admin/feedback', icon: MessageSquare },
    ],
  },
];

function isNavItemActive(pathname: string, item: NavItem): boolean {
  if (item.exactMatch) {
    return pathname === item.href;
  }
  return pathname.startsWith(item.href);
}

export function AdminCommandSidebar() {
  const pathname = usePathname();
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const sidebarContent = (
    <aside className="w-64 bg-surface-container-low border-r border-outline-variant h-screen sticky top-0 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-outline-variant">
        <h1 className="text-lg font-semibold text-on-surface">PropertyIQ Admin</h1>
        <p className="text-xs text-on-surface-variant">Command Center</p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-2">
        {NAV_GROUPS.map((group) => (
          <div key={group.title} className="mb-4">
            <div className="px-3 py-2 text-xs font-medium text-on-surface-variant uppercase tracking-wider">
              {group.title}
            </div>
            <div className="space-y-1">
              {group.items.map((item) => {
                const active = isNavItemActive(pathname, item);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setIsMobileOpen(false)}
                    className={`
                      flex items-center gap-3 px-3 py-2 rounded-lg text-sm
                      ${active
                        ? 'bg-primary/10 text-primary font-medium'
                        : 'text-on-surface-variant hover:bg-surface-container-high'
                      }
                    `}
                  >
                    <item.icon className="w-5 h-5" />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-outline-variant">
        <Link
          href="/"
          className="flex items-center gap-2 text-xs text-on-surface-variant hover:text-primary transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to PropertyIQ
        </Link>
      </div>
    </aside>
  );

  return (
    <>
      {/* Mobile hamburger toggle */}
      <button
        onClick={() => setIsMobileOpen(!isMobileOpen)}
        className="md:hidden fixed top-4 left-4 z-50 p-2 rounded-lg bg-surface-container-high shadow-md text-on-surface"
        aria-label={isMobileOpen ? 'Close admin menu' : 'Open admin menu'}
      >
        {isMobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>

      {/* Mobile overlay */}
      {isMobileOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/50"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Mobile sidebar */}
      <div
        className={`
          md:hidden fixed inset-y-0 left-0 z-40 transform transition-transform duration-300
          ${isMobileOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        {sidebarContent}
      </div>

      {/* Desktop sidebar */}
      <div className="hidden md:block">
        {sidebarContent}
      </div>
    </>
  );
}
