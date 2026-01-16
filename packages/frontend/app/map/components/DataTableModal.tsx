'use client';

import { useState, useMemo } from 'react';
import type { GeoLevel, MapData } from '../types';
import { getValueFromEntry, getDateFromEntry } from '../types';
import { getMetricFormat, getMetricTitle } from '../config';
import type { MetricFormat } from '../config';

interface DataTableModalProps {
    isOpen: boolean;
    onClose: () => void;
    mapData: MapData;
    selectedMetric: string;
    geoLevel: GeoLevel;
    forecastHorizon?: string;
}

// Format value based on metric format type
function formatValue(value: number | null, format: MetricFormat): string {
    if (value === null || value === undefined) return '—';

    switch (format) {
        case 'currency':
            return value >= 1000000
                ? `$${(value / 1000000).toFixed(2)}M`
                : value >= 1000
                    ? `$${(value / 1000).toFixed(0)}K`
                    : `$${value.toLocaleString()}`;
        case 'percent':
        case 'percent_abs':
            return `${value.toFixed(1)}%`;
        case 'number':
            return value >= 1000
                ? `${(value / 1000).toFixed(1)}K`
                : value.toLocaleString();
        case 'days':
            return `${Math.round(value)} days`;
        case 'index':
            return value.toFixed(1);
        default:
            return value.toLocaleString();
    }
}

// Sort type
type SortDirection = 'asc' | 'desc';
type SortField = 'name' | 'value';

export function DataTableModal({ isOpen, onClose, mapData, selectedMetric, geoLevel, forecastHorizon }: DataTableModalProps) {
    const [sortField, setSortField] = useState<SortField>('value');
    const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
    const [searchFilter, setSearchFilter] = useState('');

    // Get metric display info from central config
    const metricFormat = getMetricFormat(selectedMetric);
    const metricName = getMetricTitle(selectedMetric, forecastHorizon);

    // Transform mapData into table rows
    const tableData = useMemo(() => {
        const entries = Object.entries(mapData).map(([key, entry]) => {
            const value = getValueFromEntry(entry);
            const date = getDateFromEntry(entry);
            return {
                id: key,
                name: key,
                value,
                date,
            };
        });

        // Filter by search
        let filtered = entries;
        if (searchFilter) {
            const search = searchFilter.toLowerCase();
            filtered = entries.filter(e => e.name.toLowerCase().includes(search));
        }

        // Sort
        filtered.sort((a, b) => {
            if (sortField === 'name') {
                const cmp = a.name.localeCompare(b.name);
                return sortDirection === 'asc' ? cmp : -cmp;
            } else {
                const aVal = a.value ?? -Infinity;
                const bVal = b.value ?? -Infinity;
                return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
            }
        });

        return filtered;
    }, [mapData, sortField, sortDirection, searchFilter]);

    const handleSort = (field: SortField) => {
        if (sortField === field) {
            setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDirection('desc');
        }
    };

    // Get geo level display name
    const geoLevelName = geoLevel.charAt(0).toUpperCase() + geoLevel.slice(1);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-on-surface/50 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="relative bg-surface-container-lowest rounded-3xl elevation-3 w-full max-w-4xl max-h-[80vh] flex flex-col overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-outline-variant">
                    <div>
                        <h2 className="text-xl font-medium text-on-surface">{metricName}</h2>
                        <p className="text-sm text-on-surface-variant mt-1">
                            {tableData.length} {geoLevelName.toLowerCase()}{tableData.length !== 1 ? 's' : ''} with data
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-surface-container rounded-full transition-colors"
                        aria-label="Close"
                    >
                        <svg className="w-6 h-6 text-on-surface-variant" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Search */}
                <div className="px-6 py-3 border-b border-outline-variant">
                    <div className="relative">
                        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-on-surface-variant" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        <input
                            type="text"
                            placeholder={`Search ${geoLevelName.toLowerCase()}s...`}
                            value={searchFilter}
                            onChange={(e) => setSearchFilter(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-surface-container rounded-full text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                    </div>
                </div>

                {/* Table */}
                <div className="flex-1 overflow-auto">
                    <table className="w-full">
                        <thead className="sticky top-0 bg-surface-container-low">
                            <tr>
                                <th
                                    className="px-6 py-3 text-left text-sm font-medium text-on-surface-variant cursor-pointer hover:bg-surface-container transition-colors"
                                    onClick={() => handleSort('name')}
                                >
                                    <div className="flex items-center gap-2">
                                        {geoLevelName}
                                        {sortField === 'name' && (
                                            <svg className={`w-4 h-4 transition-transform ${sortDirection === 'asc' ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                            </svg>
                                        )}
                                    </div>
                                </th>
                                <th
                                    className="px-6 py-3 text-right text-sm font-medium text-on-surface-variant cursor-pointer hover:bg-surface-container transition-colors"
                                    onClick={() => handleSort('value')}
                                >
                                    <div className="flex items-center justify-end gap-2">
                                        Value
                                        {sortField === 'value' && (
                                            <svg className={`w-4 h-4 transition-transform ${sortDirection === 'asc' ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                            </svg>
                                        )}
                                    </div>
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-outline-variant">
                            {tableData.length === 0 ? (
                                <tr>
                                    <td colSpan={2} className="px-6 py-12 text-center text-on-surface-variant">
                                        No data available
                                    </td>
                                </tr>
                            ) : (
                                tableData.map((row, index) => (
                                    <tr
                                        key={row.id}
                                        className={`hover:bg-surface-container transition-colors ${index % 2 === 0 ? 'bg-surface' : 'bg-surface-container-lowest'}`}
                                    >
                                        <td className="px-6 py-3 text-sm text-on-surface">
                                            {row.name}
                                        </td>
                                        <td className="px-6 py-3 text-sm text-on-surface text-right font-medium tabular-nums">
                                            {formatValue(row.value, metricFormat)}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between px-6 py-4 border-t border-outline-variant bg-surface-container-low">
                    <p className="text-sm text-on-surface-variant">
                        Showing {tableData.length} of {Object.keys(mapData).length} records
                    </p>
                    <button
                        onClick={onClose}
                        className="px-6 py-2 bg-primary text-on-primary rounded-full font-medium hover:bg-primary/90 transition-colors"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
}
