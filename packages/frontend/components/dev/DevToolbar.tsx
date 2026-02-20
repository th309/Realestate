'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  ChevronUp,
  ChevronDown,
  Settings,
  RotateCcw,
  Search,
  LayoutDashboard,
  Layers,
  Users,
  Clock,
  BarChart3,
} from 'lucide-react';
import { useEntitlements } from '@/lib/entitlements';
import type { UserTier, ResourceType, AccessInfo } from '@/lib/entitlements';

const TIERS: UserTier[] = ['free', 'pro', 'enterprise', 'admin'];

const TIER_COLORS: Record<UserTier, string> = {
  free: 'bg-outline-variant text-on-surface-variant',
  pro: 'bg-primary text-on-primary',
  enterprise: 'bg-tertiary text-on-tertiary',
  admin: 'bg-error text-on-error',
};

const ACCESS_COLORS: Record<string, string> = {
  full: 'bg-green-500',
  preview: 'bg-amber-500',
  none: 'bg-red-500',
};

const ADMIN_LINKS = [
  { label: 'Overview', href: '/admin/entitlements', icon: LayoutDashboard },
  { label: 'Tiers', href: '/admin/entitlements/tiers', icon: Layers },
  { label: 'Users', href: '/admin/entitlements/users', icon: Users },
  { label: 'Trial', href: '/admin/entitlements/trial', icon: Clock },
  { label: 'Analytics', href: '/admin/entitlements/analytics', icon: BarChart3 },
];

function useDevToolbarActive(): boolean {
  const [active, setActive] = useState(false);

  useEffect(() => {
    const isDev = process.env.NODE_ENV === 'development';
    const sessionFlag = sessionStorage.getItem('devtools-active') === 'true';

    if (isDev || sessionFlag) {
      setActive(true);
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const key = params.get('devtools');
    const expectedKey = process.env.NEXT_PUBLIC_DEVTOOLS_KEY || 'dev';
    if (key === expectedKey) {
      sessionStorage.setItem('devtools-active', 'true');
      setActive(true);
    }
  }, []);

  return active;
}

export function DevToolbar() {
  const active = useDevToolbarActive();
  const [expanded, setExpanded] = useState(false);
  const [checkerInput, setCheckerInput] = useState('');

  const {
    tier,
    access,
    trial,
    loading,
    simulatedTier,
    setSimulatedTier,
    simulatedAuth,
    setSimulatedAuth,
    resetSimulation,
    getAccess,
  } = useEntitlements();

  const displayTier = simulatedTier || tier;

  const accessEntries = useMemo(
    () => Object.entries(access).filter(([, info]) => info.level !== 'full').slice(0, 8),
    [access]
  );

  const allAccessEntries = useMemo(
    () => Object.entries(access),
    [access]
  );

  const checkerResult = useMemo<AccessInfo | null>(() => {
    if (!checkerInput.includes(':')) return null;
    const [type, id] = checkerInput.split(':') as [ResourceType, string];
    if (!type || !id) return null;
    return getAccess(type, id);
  }, [checkerInput, getAccess]);

  const cycleTier = () => {
    const currentIndex = TIERS.indexOf(displayTier);
    const nextTier = TIERS[(currentIndex + 1) % TIERS.length];
    setSimulatedTier(nextTier);
  };

  if (!active) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50" data-testid="dev-toolbar">
      {/* Expanded Panel */}
      {expanded && (
        <div className="bg-surface-container-highest/95 backdrop-blur-sm border-t border-outline-variant">
          <div className="max-w-7xl mx-auto px-4 py-4 grid grid-cols-3 gap-6 max-h-[300px]">
            {/* Left Column — Simulation Controls */}
            <div className="space-y-4">
              <div>
                <div className="text-xs font-medium text-on-surface-variant uppercase tracking-wider mb-2">
                  Tier Simulation
                </div>
                <div className="flex rounded-lg overflow-hidden border border-outline-variant">
                  {TIERS.map((t) => (
                    <button
                      key={t}
                      onClick={() => setSimulatedTier(t)}
                      className={`flex-1 px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                        displayTier === t
                          ? TIER_COLORS[t]
                          : 'bg-surface text-on-surface-variant hover:bg-surface-container'
                      }`}
                      data-testid={`tier-btn-${t}`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="text-xs font-medium text-on-surface-variant uppercase tracking-wider mb-2">
                  Auth Simulation
                </div>
                <div className="flex rounded-lg overflow-hidden border border-outline-variant">
                  <button
                    onClick={() => setSimulatedAuth(false)}
                    className={`flex-1 px-3 py-1.5 text-xs font-medium transition-colors ${
                      simulatedAuth === false
                        ? 'bg-outline-variant text-on-surface'
                        : 'bg-surface text-on-surface-variant hover:bg-surface-container'
                    }`}
                    data-testid="auth-btn-anon"
                  >
                    Anonymous
                  </button>
                  <button
                    onClick={() => setSimulatedAuth(true)}
                    className={`flex-1 px-3 py-1.5 text-xs font-medium transition-colors ${
                      simulatedAuth === true
                        ? 'bg-primary text-on-primary'
                        : 'bg-surface text-on-surface-variant hover:bg-surface-container'
                    }`}
                    data-testid="auth-btn-authed"
                  >
                    Authenticated
                  </button>
                </div>
              </div>

              <button
                onClick={resetSimulation}
                className="flex items-center gap-1.5 text-xs text-on-surface-variant hover:text-on-surface transition-colors"
                data-testid="reset-btn"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reset All Overrides
              </button>
            </div>

            {/* Center Column — Live State */}
            <div className="space-y-3">
              <div className="text-xs font-medium text-on-surface-variant uppercase tracking-wider">
                Live State
              </div>
              <div className="flex items-center gap-3 text-sm">
                <span className="text-on-surface-variant">Tier:</span>
                <span className={`px-2 py-0.5 rounded text-xs font-medium capitalize ${TIER_COLORS[displayTier]}`}>
                  {displayTier}
                </span>
                {loading && <span className="text-xs text-on-surface-variant">(loading...)</span>}
              </div>
              {trial && (
                <div className="text-sm">
                  <span className="text-on-surface-variant">Trial:</span>{' '}
                  <span className={trial.active ? 'text-green-600' : 'text-on-surface-variant'}>
                    {trial.active ? `Active (${trial.daysRemaining}d left)` : 'Inactive'}
                  </span>
                </div>
              )}
              <div className="max-h-[180px] overflow-y-auto space-y-1">
                {allAccessEntries.map(([key, info]) => (
                  <div key={key} className="flex items-center gap-2 text-xs">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${ACCESS_COLORS[info.level]}`} />
                    <span className="text-on-surface-variant truncate flex-1 font-mono">{key}</span>
                    <span className="text-on-surface-variant">{info.level}</span>
                    {info.limit && (
                      <span className="text-on-surface-variant/60">({info.limit})</span>
                    )}
                    {info.tierRequired && info.level !== 'full' && (
                      <span className="text-on-surface-variant/60">→{info.tierRequired}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Right Column — Admin Nav + Resource Checker */}
            <div className="space-y-4">
              <div>
                <div className="text-xs font-medium text-on-surface-variant uppercase tracking-wider mb-2">
                  Admin Pages
                </div>
                <div className="space-y-1">
                  {ADMIN_LINKS.map(({ label, href, icon: Icon }) => (
                    <Link
                      key={href}
                      href={href}
                      className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs text-on-surface-variant hover:bg-surface-container hover:text-on-surface transition-colors"
                    >
                      <Icon className="w-3.5 h-3.5" />
                      {label}
                    </Link>
                  ))}
                </div>
              </div>

              <div>
                <div className="text-xs font-medium text-on-surface-variant uppercase tracking-wider mb-2">
                  Resource Checker
                </div>
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-on-surface-variant" />
                  <input
                    type="text"
                    value={checkerInput}
                    onChange={(e) => setCheckerInput(e.target.value)}
                    placeholder="metric:home_value"
                    className="w-full pl-7 pr-3 py-1.5 text-xs bg-surface border border-outline-variant rounded-lg text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:border-primary"
                    data-testid="resource-checker-input"
                  />
                </div>
                {checkerResult && (
                  <div className="mt-2 px-2 py-1.5 bg-surface rounded-lg border border-outline-variant/50" data-testid="resource-checker-result">
                    <div className="flex items-center gap-2 text-xs">
                      <div className={`w-2 h-2 rounded-full ${ACCESS_COLORS[checkerResult.level]}`} />
                      <span className="font-medium text-on-surface capitalize">{checkerResult.level}</span>
                      {checkerResult.limit && (
                        <span className="text-on-surface-variant">(limit: {checkerResult.limit})</span>
                      )}
                      {checkerResult.tierRequired && checkerResult.level !== 'full' && (
                        <span className="text-on-surface-variant">requires {checkerResult.tierRequired}</span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Bar (Always Visible) */}
      <div className="bg-surface-container-highest/95 backdrop-blur-sm border-t border-outline-variant px-4 h-10 flex items-center gap-3">
        {/* Tier Badge */}
        <button
          onClick={cycleTier}
          className={`px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wide ${TIER_COLORS[displayTier]} cursor-pointer hover:opacity-80 transition-opacity`}
          title="Click to cycle tier"
          data-testid="tier-badge"
        >
          {displayTier}
        </button>

        {/* Auth Status */}
        <span className="text-xs text-on-surface-variant" data-testid="auth-status">
          {simulatedAuth === null ? 'Real Auth' : simulatedAuth ? 'Authed' : 'Anon'}
        </span>

        {/* Separator */}
        <div className="w-px h-4 bg-outline-variant" />

        {/* Resource Summary */}
        <div className="flex-1 flex items-center gap-2 overflow-hidden">
          {accessEntries.length > 0 ? (
            accessEntries.map(([key, info]) => (
              <span key={key} className="text-[10px] text-on-surface-variant whitespace-nowrap font-mono">
                <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1 ${ACCESS_COLORS[info.level]}`} />
                {key.length > 20 ? `...${key.slice(-18)}` : key}
              </span>
            ))
          ) : (
            <span className="text-[10px] text-on-surface-variant/50">
              {loading ? 'Loading...' : 'All resources: full access'}
            </span>
          )}
        </div>

        {/* Admin Link */}
        <Link
          href="/admin/entitlements"
          className="p-1.5 rounded-lg text-on-surface-variant hover:bg-surface-container hover:text-on-surface transition-colors"
          title="Admin Panel"
        >
          <Settings className="w-4 h-4" />
        </Link>

        {/* Expand/Collapse Toggle */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="p-1.5 rounded-lg text-on-surface-variant hover:bg-surface-container hover:text-on-surface transition-colors"
          data-testid="expand-toggle"
          title={expanded ? 'Collapse' : 'Expand'}
        >
          {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}
