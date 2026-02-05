'use client';

import { useState } from 'react';
import { Map, BarChart3, FileText } from 'lucide-react';
import { MapPreview } from './demos/MapPreview';
import { ChartPreview } from './demos/ChartPreview';
import { BuilderPreview } from './demos/BuilderPreview';

const DEMO_TABS = [
  {
    id: 'map',
    label: 'Explore Map',
    icon: Map,
    description: 'Interactive market heat maps with real-time data',
  },
  {
    id: 'charts',
    label: 'Analyze Data',
    icon: BarChart3,
    description: 'Price trends and market analytics',
  },
  {
    id: 'reports',
    label: 'Build Reports',
    icon: FileText,
    description: 'Drag-and-drop report builder',
  },
];

export function DemoSection() {
  const [activeTab, setActiveTab] = useState('map');

  const currentTab = DEMO_TABS.find(t => t.id === activeTab) || DEMO_TABS[0];

  return (
    <section
      id="demo"
      className="py-16 px-6 bg-surface-container-lowest scroll-mt-20"
      aria-labelledby="demo-heading"
    >
      <div className="max-w-5xl mx-auto">
        {/* Section header */}
        <header className="text-center max-w-xl mx-auto mb-8">
          <span className="text-sm font-semibold text-primary uppercase tracking-widest">
            Interactive Demo
          </span>
          <h2
            id="demo-heading"
            className="text-2xl md:text-3xl font-bold text-on-surface mt-3 mb-4 tracking-tight"
          >
            See PropertyIQ in Action
          </h2>
          <p className="text-on-surface-variant">
            Explore real features with live data. Click around, interact, and see how PropertyIQ
            helps you make smarter real estate decisions.
          </p>
        </header>

        {/* Tab navigation */}
        <div className="flex justify-center mb-6">
          <div className="inline-flex bg-surface-container rounded-xl p-1.5 gap-1">
            {DEMO_TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`
                    flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium
                    transition-all duration-200
                    ${isActive
                      ? 'bg-primary text-on-primary shadow-md'
                      : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high'
                    }
                  `}
                  aria-selected={isActive}
                  role="tab"
                >
                  <Icon className="w-4 h-4" />
                  <span className="hidden sm:inline">{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Tab description */}
        <p className="text-center text-sm text-on-surface-variant mb-6">
          {currentTab.description}
        </p>

        {/* Demo preview area */}
        <div className="relative bg-surface rounded-2xl shadow-xl border border-outline-variant/30 overflow-hidden">
          {/* Browser-like frame */}
          <div className="h-10 bg-surface-container-highest flex items-center px-4 gap-3 border-b border-outline-variant/30">
            <div className="flex gap-2">
              <div className="w-3 h-3 rounded-full bg-error/60" />
              <div className="w-3 h-3 rounded-full bg-tertiary/60" />
              <div className="w-3 h-3 rounded-full bg-primary/60" />
            </div>
            <div className="flex-1 max-w-sm">
              <div className="h-6 bg-surface-container rounded-full flex items-center px-3 gap-2">
                <svg className="w-3 h-3 text-on-surface-variant/50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8" />
                  <path d="M21 21l-4.35-4.35" />
                </svg>
                <span className="text-xs text-on-surface-variant">
                  propertyiq.com/{activeTab === 'map' ? 'map' : activeTab === 'charts' ? 'graphs' : 'reports'}
                </span>
              </div>
            </div>
          </div>

          {/* Demo content */}
          <div className="h-[380px] md:h-[420px]">
            {activeTab === 'map' && <MapPreview />}
            {activeTab === 'charts' && <ChartPreview />}
            {activeTab === 'reports' && <BuilderPreview />}
          </div>
        </div>

        {/* Bottom note */}
        <p className="text-center text-xs text-on-surface-variant mt-4">
          This is a live preview with sample data. Sign up free to access full features and real market data.
        </p>
      </div>
    </section>
  );
}
