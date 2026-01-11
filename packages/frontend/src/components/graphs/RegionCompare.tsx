
'use client';

import React, { useState } from 'react';
import type { MetricConfig } from '@/config/metric-registry';

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

    // Mock list of potential regions to add
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

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Compare Markets</h3>
                {!isAdding && (
                    <button
                        onClick={() => setIsAdding(true)}
                        className="text-sm text-blue-600 font-medium hover:text-blue-700 hover:bg-blue-50 px-3 py-1 rounded-md transition-colors"
                    >
                        + Add Market
                    </button>
                )}
            </div>

            <div className="flex flex-col gap-3">
                {/* Main Region (Active) */}
                <div className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-100 rounded-lg">
                    <div className="w-3 h-3 rounded-full bg-blue-500" />
                    <span className="font-medium text-gray-900">{currentRegion.name}</span>
                    <span className="ml-auto text-xs font-medium text-blue-700 bg-white px-2 py-1 rounded border border-blue-100">Primary</span>
                </div>

                {/* Comparison Regions */}
                {compareRegions.map((region, index) => (
                    <div key={region} className="flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-lg group hover:border-gray-300 transition-colors">
                        <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: ['#8b5cf6', '#f59e0b', '#ec4899'][index % 3] }}
                        />
                        <span className="text-gray-700">{region}</span>
                        <button
                            onClick={() => onRemoveRegion(region)}
                            className="ml-auto text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                            aria-label="Remove region"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                            </svg>
                        </button>
                    </div>
                ))}

                {/* Add Region Input */}
                {isAdding && (
                    <div className="relative mt-2">
                        <div className="flex items-center gap-2 mb-2">
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder="Search market..."
                                className="flex-1 px-3 py-2 border border-blue-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                autoFocus
                            />
                            <button
                                onClick={() => { setIsAdding(false); setSearchTerm(''); }}
                                className="text-gray-500 hover:text-gray-700 p-2"
                            >
                                ✕
                            </button>
                        </div>

                        {filteredRegions.length > 0 && (
                            <div className="absolute top-10 left-0 w-full bg-white border border-gray-200 rounded-lg shadow-lg z-10 max-h-48 overflow-y-auto">
                                {filteredRegions.map(region => (
                                    <button
                                        key={region}
                                        onClick={() => {
                                            onAddRegion(region);
                                            setIsAdding(false);
                                            setSearchTerm('');
                                        }}
                                        className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 first:rounded-t-lg last:rounded-b-lg"
                                    >
                                        {region}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};
