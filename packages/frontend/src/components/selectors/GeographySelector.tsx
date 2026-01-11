
'use client';

import React from 'react';
import type { MetricConfig } from '@/src/config/metric-registry';

interface GeographySelectorProps {
    currentLevel: 'national' | 'state' | 'metro' | 'county' | 'zip' | 'city';
    currentRegion: { id: string; name: string };
    availableLevels: MetricConfig['geoLevels'];
    onSelect: (region: { id: string; name: string }, level: 'national' | 'state' | 'metro' | 'county' | 'zip' | 'city') => void;
}

export const GeographySelector: React.FC<GeographySelectorProps> = ({
    currentLevel,
    currentRegion,
    availableLevels,
    onSelect,
}) => {
    const handleLevelChange = (level: 'national' | 'state' | 'metro' | 'county' | 'zip' | 'city') => {
        // Keep current region if switching levels, though typically region might need to change (e.g. invalid at new level)
        // For now, we trust the parent or just pass the current region.
        // Ideally if one switches to "State" from "National", we might default to "US" or keep "US" if it's national? 
        // Actually National level implies region is US.
        if (level === 'national') {
            onSelect({ id: 'national', name: 'United States' }, 'national');
        } else {
            onSelect(currentRegion, level);
        }
    };

    return (
        <div className="w-full max-w-xs">
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
                Geography Level
            </label>
            <div className="relative">
                <select
                    value={currentLevel}
                    onChange={(e) => handleLevelChange(e.target.value as any)}
                    className="block w-full bg-white border border-gray-300 hover:border-gray-400 px-4 py-2 pr-8 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm appearance-none capitalize transition-colors"
                >
                    {availableLevels.map((level) => (
                        <option key={level} value={level}>
                            {level}
                        </option>
                    ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                    </svg>
                </div>
            </div>
        </div>
    );
};
