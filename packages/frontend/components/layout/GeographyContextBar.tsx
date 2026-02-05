'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  MapPin, Map, TrendingUp, FileText, ChevronRight, X,
  History, ChevronDown
} from 'lucide-react';
import { useGeography, formatGeographyName, getGeoLevelDisplayName } from '@/contexts/GeographyContext';
import { Badge } from '@/components/ui/Badge';

interface GeographyContextBarProps {
  className?: string;
}

export const GeographyContextBar: React.FC<GeographyContextBarProps> = ({
  className = '',
}) => {
  const pathname = usePathname();
  const { geography, geoLevel, recentGeographies, setGeography, clearGeography } = useGeography();
  const [showRecent, setShowRecent] = useState(false);

  // Don't show on home page
  if (pathname === '/') return null;

  // Quick action buttons based on current page
  const quickActions = [
    {
      label: 'Map',
      href: '/map',
      icon: Map,
      active: pathname?.startsWith('/map'),
    },
    {
      label: 'Trends',
      href: '/graphs',
      icon: TrendingUp,
      active: pathname?.startsWith('/graphs'),
    },
    {
      label: 'Report',
      href: '/reports',
      icon: FileText,
      active: pathname?.startsWith('/reports'),
    },
  ];

  if (!geography) {
    // Show minimal bar when no geography selected
    return (
      <div
        className={`
          bg-surface-container border-b border-outline-variant
          px-4 py-2
          ${className}
        `}
      >
        <div className="max-w-[1920px] mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2 text-on-surface-variant">
            <MapPin className="w-4 h-4" />
            <span className="text-sm">Select a location to get started</span>
          </div>

          {/* Show recent if available */}
          {recentGeographies.length > 0 && (
            <div className="relative">
              <button
                onClick={() => setShowRecent(!showRecent)}
                className="flex items-center gap-1 text-sm text-primary hover:text-primary/80 transition-colors"
              >
                <History className="w-4 h-4" />
                Recent
                <ChevronDown className={`w-4 h-4 transition-transform ${showRecent ? 'rotate-180' : ''}`} />
              </button>

              {showRecent && (
                <div className="absolute right-0 top-full mt-1 w-64 bg-surface-container-high rounded-xl elevation-2 border border-outline-variant py-1 z-50">
                  {recentGeographies.slice(0, 5).map((geo) => (
                    <button
                      key={geo.id}
                      onClick={() => {
                        setGeography(geo);
                        setShowRecent(false);
                      }}
                      className="w-full px-3 py-2 text-left text-sm hover:bg-surface-container transition-colors"
                    >
                      <div className="font-medium text-on-surface">{geo.name}</div>
                      <div className="text-xs text-on-surface-variant">
                        {getGeoLevelDisplayName(geo.type)}
                        {geo.parentName && ` • ${geo.parentName}`}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className={`
        bg-surface-container border-b border-outline-variant
        px-4 py-2
        ${className}
      `}
    >
      <div className="max-w-[1920px] mx-auto flex items-center justify-between gap-4">
        {/* Left: Geography Info */}
        <div className="flex items-center gap-3 min-w-0">
          {/* Geography pill */}
          <div className="flex items-center gap-2 bg-primary-container/30 rounded-full pl-2 pr-3 py-1">
            <MapPin className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium text-on-surface truncate">
              {formatGeographyName(geography)}
            </span>
            <Badge variant="soft" color="primary" size="sm">
              {getGeoLevelDisplayName(geoLevel)}
            </Badge>
            <button
              onClick={clearGeography}
              className="p-0.5 hover:bg-primary/10 rounded-full transition-colors"
              aria-label="Clear selection"
            >
              <X className="w-3.5 h-3.5 text-on-surface-variant" />
            </button>
          </div>

          {/* Breadcrumb-style parent link */}
          {geography.parentName && (
            <div className="hidden sm:flex items-center gap-1 text-xs text-on-surface-variant">
              <ChevronRight className="w-3 h-3" />
              <span>{geography.parentName}</span>
            </div>
          )}
        </div>

        {/* Right: Quick Actions */}
        <div className="flex items-center gap-1">
          {quickActions.map((action) => {
            const Icon = action.icon;
            const params = geography ? `?area=${encodeURIComponent(geography.id)}` : '';

            return (
              <Link
                key={action.label}
                href={`${action.href}${params}`}
                className={`
                  flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium
                  transition-all duration-200
                  ${action.active
                    ? 'bg-secondary-container text-on-secondary-container'
                    : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'
                  }
                `}
              >
                <Icon className="w-4 h-4" />
                <span className="hidden sm:inline">{action.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// Compact version for sidebars
export const GeographyContextCompact: React.FC<{
  className?: string;
  onSelect?: () => void;
}> = ({ className = '', onSelect }) => {
  const { geography, geoLevel, clearGeography } = useGeography();

  if (!geography) {
    return (
      <div
        className={`
          flex items-center gap-2 p-3 bg-surface-container rounded-xl
          ${className}
        `}
      >
        <MapPin className="w-4 h-4 text-on-surface-variant" />
        <span className="text-sm text-on-surface-variant">No location selected</span>
      </div>
    );
  }

  return (
    <div
      className={`
        flex items-center justify-between gap-2 p-3
        bg-primary-container/20 rounded-xl border border-primary-container/50
        ${className}
      `}
    >
      <div className="flex items-center gap-2 min-w-0">
        <MapPin className="w-4 h-4 text-primary shrink-0" />
        <div className="min-w-0">
          <div className="text-sm font-medium text-on-surface truncate">
            {geography.name}
          </div>
          <div className="text-xs text-on-surface-variant">
            {getGeoLevelDisplayName(geoLevel)}
          </div>
        </div>
      </div>
      <button
        onClick={clearGeography}
        className="p-1 hover:bg-primary/10 rounded-full transition-colors shrink-0"
      >
        <X className="w-4 h-4 text-on-surface-variant" />
      </button>
    </div>
  );
};
