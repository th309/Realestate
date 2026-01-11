
'use client';

import React, { useState } from 'react';
import type { MetricConfig } from '@/src/config/metric-registry';

interface RegionCompareProps {
    metricId: string;
    currentRegion: { id: string; name: string };
    geoLevel: string;
    compareRegions: string[]; // List of region names being compared
    onAddRegion: (regionName: string) => void;
    onRemoveRegion: (regionName: string) => void;
}

export const RegionCompare: React.FC<RegionCompareProps> = ({
    metricId,
    currentRegion,
    geoLevel,
    compareRegions,
    onAddRegion,
    onRemoveRegion,
}) => {
    const [isAdding, setIsAdding] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const containerRef = React.useRef<HTMLDivElement>(null);

    // Mock list
    const MOCK_REGIONS = [
        'National Average',
        'California',
        'Texas',
        'New York',
        'Florida',
        'Chicago, IL',
        'Austin, TX',
        'Seattle, WA'
    ].filter(r => r !== currentRegion.name && !compareRegions.includes(r));

    const filteredRegions = MOCK_REGIONS.filter(r =>
        r.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Close on click outside
    React.useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setIsAdding(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div className="w-full space-y-3" ref={containerRef}>
            <div className="flex items-center justify-between">
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Compare Markets
                </label>
            </div>

            <div className="flex flex-col gap-2">
                {/* Main Region (Active) */}
                <div className="flex items-center gap-2 p-2 bg-blue-50 border border-blue-100 rounded-lg">
                    <div className="w-2.5 h-2.5 rounded-full bg-blue-500 shrink-0" />
                    <span className="font-medium text-gray-900 text-sm truncate">{currentRegion.name}</span>
                </div>

                {/* Comparison Regions */}
                {compareRegions.map((region, index) => (
                    <div key={region} className="flex items-center gap-2 p-2 bg-white border border-gray-200 rounded-lg group hover:border-gray-300 transition-colors">
                        <div
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: ['#8b5cf6', '#f59e0b', '#ec4899'][index % 3] }}
                        />
                        <span className="text-gray-700 text-sm truncate flex-1">{region}</span>
                        <button
                            onClick={() => onRemoveRegion(region)}
                            className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity p-0.5"
                            aria-label="Remove region"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                            </svg>
                        </button>
                    </div>
                ))}

                {/* Add Region Input */}
                {isAdding ? (
                    <div className="relative">
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Type to search..."
                            className="w-full px-3 py-2 border border-blue-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            autoFocus
                        />
                        {filteredRegions.length > 0 && (
                            <div className="absolute top-full left-0 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 max-h-48 overflow-y-auto">
                                {filteredRegions.map(region => (
                                    <button
                                        key={region}
                                        onClick={() => {
                                            onAddRegion(region);
                                            setIsAdding(false);
                                            setSearchTerm('');
                                        }}
                                        className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 first:rounded-t-lg last:rounded-b-lg"
                                    >
                                        {region}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                ) : (
                    <button
                        onClick={() => setIsAdding(true)}
                        className="flex items-center justify-center gap-1.5 w-full py-2 border border-dashed border-gray-300 rounded-lg text-sm text-gray-500 hover:text-blue-600 hover:border-blue-300 hover:bg-blue-50 transition-all"
                    >
                        + Add Region
                    </button>
                )}
            </div>
        </div>
    );
};
