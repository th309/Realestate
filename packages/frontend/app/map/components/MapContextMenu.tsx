'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { BarChart3, LineChart, FileText, Lock } from 'lucide-react';
import type { SelectedGeography } from '../types';
import { useEntitlements } from '@/lib/entitlements';
import { PaywallCard } from '@/components/entitlements/PaywallCard';

interface MapContextMenuProps {
  geography: SelectedGeography;
  x: number;
  y: number;
  onClose: () => void;
}

export function MapContextMenu({ geography, x, y, onClose }: MapContextMenuProps) {
  const router = useRouter();
  const menuRef = useRef<HTMLDivElement>(null);
  const paywallRef = useRef<HTMLDivElement>(null);
  const { canAccess } = useEntitlements();
  const [paywall, setPaywall] = useState<{ type: 'geo' | 'feature'; id: string; title: string } | null>(null);

  const geoGated = !canAccess('geo', geography.geoLevel);
  const reportsGated = !canAccess('feature', 'reports');

  // Clamp menu position to stay within viewport
  const [pos, setPos] = useState({ top: y, left: x });
  useEffect(() => {
    if (!menuRef.current) return;
    const rect = menuRef.current.getBoundingClientRect();
    const margin = 8;
    let top = y;
    let left = x;
    if (left + rect.width + margin > window.innerWidth) {
      left = window.innerWidth - rect.width - margin;
    }
    if (top + rect.height + margin > window.innerHeight) {
      top = window.innerHeight - rect.height - margin;
    }
    setPos({ top, left });
  }, [x, y]);

  // Dismiss on click-outside or Escape
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      const target = e.target as Node;
      if (menuRef.current && !menuRef.current.contains(target) &&
          (!paywallRef.current || !paywallRef.current.contains(target))) {
        onClose();
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  const displayName = geography.stateAbbr
    ? `${geography.name}, ${geography.stateAbbr}`
    : geography.name;

  function handleMarkets() {
    if (geoGated) {
      setPaywall({ type: 'geo', id: geography.geoLevel, title: `Unlock ${geography.geoLevel} data` });
      return;
    }
    const params = new URLSearchParams({ type: geography.geoLevel });
    if (geography.stateAbbr) params.set('state', geography.stateAbbr);
    router.push(`/market/${geography.id}?${params.toString()}`);
    onClose();
  }

  function handleGraphs() {
    if (geoGated) {
      setPaywall({ type: 'geo', id: geography.geoLevel, title: `Unlock ${geography.geoLevel} data` });
      return;
    }
    const params = new URLSearchParams({
      geo: geography.id,
      level: geography.geoLevel,
      name: geography.name,
    });
    router.push(`/graphs?${params.toString()}`);
    onClose();
  }

  function handleReports() {
    if (geoGated) {
      setPaywall({ type: 'geo', id: geography.geoLevel, title: `Unlock ${geography.geoLevel} data` });
      return;
    }
    if (reportsGated) {
      setPaywall({ type: 'feature', id: 'reports', title: 'Unlock Reports' });
      return;
    }
    // Pre-fill report form via localStorage
    try {
      localStorage.setItem('propertyiq-report-prefill', JSON.stringify({
        id: geography.id,
        name: geography.name,
        type: geography.geoLevel,
        state: geography.stateAbbr,
      }));
    } catch { /* ignore */ }
    router.push('/reports');
    onClose();
  }

  const items = [
    { label: 'View in Markets', icon: BarChart3, onClick: handleMarkets, locked: geoGated },
    { label: 'View in Graphs', icon: LineChart, onClick: handleGraphs, locked: geoGated },
    { label: 'Generate Report', icon: FileText, onClick: handleReports, locked: geoGated || reportsGated },
  ];

  return createPortal(
    <>
      <div
        ref={menuRef}
        className="fixed z-[99999] min-w-[200px] bg-surface-container-lowest rounded-2xl elevation-3 border border-outline-variant/40 py-1.5 animate-in fade-in zoom-in-95 duration-100"
        style={{ top: pos.top, left: pos.left }}
      >
        {/* Header with geo name */}
        <div className="px-3 py-2 border-b border-outline-variant/30">
          <div className="text-xs font-semibold text-on-surface truncate">{displayName}</div>
          <div className="text-[10px] text-on-surface-variant capitalize">{geography.geoLevel}</div>
        </div>

        {/* Menu items */}
        {items.map(({ label, icon: Icon, onClick, locked }) => (
          <button
            key={label}
            onClick={onClick}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-on-surface hover:bg-surface-container transition-colors duration-150"
          >
            <Icon className="w-4 h-4 text-on-surface-variant flex-shrink-0" />
            <span className="flex-1 text-left">{label}</span>
            {locked && <Lock className="w-3 h-3 text-on-surface-variant/60 flex-shrink-0" />}
          </button>
        ))}
      </div>

      {/* Paywall modal */}
      {paywall && (
        <div
          ref={paywallRef}
          className="fixed inset-0 z-[100000] flex items-center justify-center bg-scrim/40"
          onClick={() => setPaywall(null)}
        >
          <div className="max-w-sm mx-4" onClick={e => e.stopPropagation()}>
            <PaywallCard
              type={paywall.type}
              id={paywall.id}
              title={paywall.title}
            />
          </div>
        </div>
      )}
    </>,
    document.body
  );
}
