
'use client';

import React, { useState, useRef, useEffect } from 'react';
import { SearchIcon, LocationPinIcon, MailboxIcon, BuildingIcon } from '@/src/components/common/Icons';

export interface SearchResult {
    id: string;
    name: string;
    type: 'state' | 'metro' | 'county' | 'zip' | 'city';
    center?: [number, number];
    state?: string;
}

interface GraphSearchBarProps {
    onSelect: (result: SearchResult) => void;
}

export const GraphSearchBar: React.FC<GraphSearchBarProps> = ({ onSelect }) => {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<SearchResult[]>([]);
    const [loading, setLoading] = useState(false);
    const [showResults, setShowResults] = useState(false);
    const searchRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
                setShowResults(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSearch = async (value: string) => {
        setQuery(value);
        if (value.length < 2) {
            setResults([]);
            // Don't hide results immediately if user is typing backspace, but do if empty
            if (value.length === 0) setShowResults(false);
            return;
        }

        setLoading(true);
        setShowResults(true);

        try {
            const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
            if (!token) {
                console.warn('Mapbox token not found');
                return;
            }

            const response = await fetch(
                `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(value)}.json?` +
                `access_token=${token}&` +
                `country=US&` +
                `types=region,place,postcode,district&` +
                `limit=5`
            );
            const data = await response.json();

            const mappedResults: SearchResult[] = data.features?.map((feature: any) => {
                let type: SearchResult['type'] = 'city';
                if (feature.place_type.includes('region')) type = 'state';
                else if (feature.place_type.includes('postcode')) type = 'zip';
                else if (feature.place_type.includes('district')) type = 'county';
                else if (feature.place_type.includes('place')) type = 'city';

                const stateContext = feature.context?.find((c: any) => c.id.startsWith('region'));
                const stateAbbrev = stateContext?.short_code?.replace('US-', '') || '';

                return {
                    id: feature.id,
                    name: feature.place_name,
                    type,
                    center: feature.center,
                    state: stateAbbrev,
                };
            }) || [];

            setResults(mappedResults);
        } catch (error) {
            console.error('Search failed:', error);
            setResults([]);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="relative w-full max-w-xl" ref={searchRef}>
            <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                    <SearchIcon className="w-5 h-5" />
                </div>
                <input
                    type="text"
                    className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition duration-150 ease-in-out"
                    placeholder="Search for a city, zip, county..."
                    value={query}
                    onChange={(e) => handleSearch(e.target.value)}
                    onFocus={() => { if (query.length >= 2) setShowResults(true); }}
                />
            </div>

            {showResults && (
                <div className="absolute z-10 mt-1 w-full bg-white shadow-lg max-h-60 rounded-md py-1 text-base ring-1 ring-black ring-opacity-5 overflow-auto focus:outline-none sm:text-sm">
                    {loading ? (
                        <div className="px-4 py-2 text-gray-500">Loading...</div>
                    ) : results.length > 0 ? (
                        results.map((result) => (
                            <div
                                key={result.id}
                                className="cursor-pointer select-none relative py-2 pl-3 pr-9 hover:bg-gray-100 flex items-center gap-3"
                                onClick={() => {
                                    onSelect(result);
                                    setQuery('');
                                    setShowResults(false);
                                }}
                            >
                                <span className="text-gray-400">
                                    {result.type === 'state' ? <LocationPinIcon /> :
                                        result.type === 'zip' ? <MailboxIcon /> : <BuildingIcon />}
                                </span>
                                <div>
                                    <span className="block truncate font-medium text-gray-900">
                                        {result.name}
                                    </span>
                                    <span className="block truncate text-xs text-gray-500 capitalize">
                                        {result.type}
                                    </span>
                                </div>
                            </div>
                        ))
                    ) : query.length >= 2 ? (
                        <div className="px-4 py-2 text-gray-500">No results found</div>
                    ) : null}
                </div>
            )}
        </div>
    );
};
