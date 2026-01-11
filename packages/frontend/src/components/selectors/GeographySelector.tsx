
'use client';

import React from 'react';
import type { MetricConfig } from '@/config/metric-registry';

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
    // Mock data for regions (similar to what was in GeoLevelPills but simplified for this component's needs)
    // In a real app this would likely encompass a robust search or cascading dropdowns

    const handleLevelChange = (level: 'national' | 'state' | 'metro' | 'county' | 'zip' | 'city') => {
        if (level === 'national') {
            onSelect({ id: 'national', name: 'United States' }, 'national');
        } else {
            // For other levels, we typically keep the region if it's compatible, or reset/ask for input
            // This is a simplified behavior
            onSelect(currentRegion, level);
        }
    };

    return (
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="flex bg-gray-100 p-1 rounded-lg">
                {availableLevels.map((level) => (
                    <button
                        key={level}
                        onClick={() => handleLevelChange(level)}
                        className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors capitalize ${currentLevel === level
                                ? 'bg-white text-gray-900 shadow-sm'
                                : 'text-gray-500 hover:text-gray-900'
                            }`}
                    >
                        {level}
                    </button>
                ))}
            </div>

            {currentLevel !== 'national' && (
                <div className="relative">
                    {/* Placeholder for a region search/selector input */}
                    <div className="flex items-center gap-2 bg-white px-3 py-1.5 border border-gray-300 rounded-lg">
                        <span className="text-sm text-gray-500 w-16 uppercase text-xs font-semibold">{currentLevel}</span>
                        <span className="text-sm font-medium text-gray-900">{currentRegion.name}</span>
                        {/* In a real implementation, this would be a search input */}
                    </div>
                </div>
            )}
        </div>
    );
};
