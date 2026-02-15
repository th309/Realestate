'use client';

import React, { useMemo } from 'react';
import { MapPin, Map, Globe, Minus } from 'lucide-react';
import {
  STATE_NAMES,
  getDivisionLabel,
} from '../constants/geoRegions';
import { parseAllStatesFromName } from '../constants';

// ── Types ───────────────────────────────────────────────────────────────────

type Scope = 'state' | 'region' | 'national';
type BaselineType = 'none' | 'state' | 'region' | 'national';

interface ScopeMiniMapProps {
  /** Current value — scope or baselineType depending on mode */
  scope: string;
  onScopeChange: (value: string) => void;
  /** Two-letter state abbreviation from the primary market */
  primaryState?: string;
  /** Full name of the primary market (needed for multi-state metro labels) */
  primaryName?: string;
  /** 'scope' for scatter/bar, 'baseline' for timeline */
  mode?: 'scope' | 'baseline';
  className?: string;
}

// ── Component ───────────────────────────────────────────────────────────────

export function ScopeMiniMap({
  scope,
  onScopeChange,
  primaryState,
  primaryName,
  mode = 'scope',
  className = '',
}: ScopeMiniMapProps) {
  // Washington-Arlington-Alexandria, DC-VA-MD-WV is unique: DC is not a state,
  // so this metro doesn't belong to any single state. Show all spanned states.
  const allStates = primaryName ? parseAllStatesFromName(primaryName) : [];
  const isDCMetro = primaryState === 'DC' && allStates.length > 1;
  const stateLabel = isDCMetro
    ? allStates.join(', ')
    : primaryState
      ? (STATE_NAMES[primaryState] ?? primaryState)
      : null;
  const divisionLabel = primaryState ? getDivisionLabel(primaryState) : null;

  const sectionLabel = mode === 'baseline' ? 'Comparison Baseline' : 'Scope';

  const options = useMemo(() => {
    if (mode === 'baseline') {
      // Timeline baseline mode: None, State Avg, Census Region Avg, National Avg
      const opts = [
        { key: 'none', label: 'None', icon: Minus },
      ];
      if (stateLabel) {
        opts.push({ key: 'state', label: `${stateLabel} Avg`, icon: MapPin });
      }
      if (divisionLabel && divisionLabel !== 'Unknown') {
        opts.push({ key: 'region', label: `${divisionLabel} Avg`, icon: Map });
      }
      opts.push({ key: 'national', label: 'National Avg', icon: Globe });
      return opts;
    }

    // Scope mode: State, Census Region, Nationwide
    if (!primaryState) {
      return [
        { key: 'national' as Scope, label: 'Nationwide', icon: Globe },
      ];
    }
    return [
      { key: 'state' as Scope, label: stateLabel!, icon: MapPin },
      { key: 'region' as Scope, label: divisionLabel!, icon: Map },
      { key: 'national' as Scope, label: 'Nationwide', icon: Globe },
    ];
  }, [mode, primaryState, stateLabel, divisionLabel]);

  return (
    <div className={className}>
      <div className="text-[10px] font-semibold text-on-surface-variant uppercase tracking-wider mb-2 px-1">
        {sectionLabel}
      </div>
      <div className="flex flex-col gap-1">
        {options.map(({ key, label, icon: Icon }) => {
          const isActive = scope === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => onScopeChange(key)}
              className={`
                w-full flex items-center gap-2.5 px-3 py-1.5 rounded-xl text-xs font-medium
                transition-all duration-150
                ${isActive
                  ? 'bg-primary text-on-primary'
                  : 'text-on-surface-variant hover:bg-surface-container-high'
                }
              `}
            >
              <Icon className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="truncate">{label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default ScopeMiniMap;
