import { useState, useRef, useCallback, useEffect } from 'react';
import type { SearchResult } from '@/app/map/types';
import type { GeoLevel } from '@/app/map/config/metrics';

const MAPBOX_TOKEN = 'pk.eyJ1IjoidHJveWhvdXN0b24iLCJhIjoiY21hZzFzaXJjMGEzcDJqcHByb29xM2lndSJ9.sataRzk3HaLNolfOnIc7Jw';
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface MapboxContext {
    id: string;
    short_code?: string;
    text?: string;
}

interface MapboxFeature {
    id: string;
    text: string; // Short name (e.g., "Hagerstown" or "21740")
    place_name: string; // Full formatted name (e.g., "21740, Hagerstown, Maryland, United States")
    place_type: string[];
    center: [number, number];
    bbox?: [number, number, number, number];
    context?: MapboxContext[];
}

interface Metro {
    regionId: number;
    name: string;
    fullName?: string; // Full census name for searching (e.g., "Washington-Arlington-Alexandria")
    state?: string; // Primary state for display
}

// Static fallback list of major metros (used when backend is unavailable)
// Includes fullName for better search matching (e.g., searching "arlington" finds "Washington, DC")
const FALLBACK_METROS: Metro[] = [
    { regionId: 1, name: 'New York', fullName: 'New York-Newark-Jersey City', state: 'NY' },
    { regionId: 2, name: 'Los Angeles', fullName: 'Los Angeles-Long Beach-Anaheim', state: 'CA' },
    { regionId: 3, name: 'Chicago', fullName: 'Chicago-Naperville-Elgin', state: 'IL' },
    { regionId: 4, name: 'Dallas', fullName: 'Dallas-Fort Worth-Arlington', state: 'TX' },
    { regionId: 5, name: 'Houston', fullName: 'Houston-The Woodlands-Sugar Land', state: 'TX' },
    { regionId: 6, name: 'Washington', fullName: 'Washington-Arlington-Alexandria', state: 'DC' },
    { regionId: 7, name: 'Miami', fullName: 'Miami-Fort Lauderdale-Pompano Beach', state: 'FL' },
    { regionId: 8, name: 'Philadelphia', fullName: 'Philadelphia-Camden-Wilmington', state: 'PA' },
    { regionId: 9, name: 'Atlanta', fullName: 'Atlanta-Sandy Springs-Alpharetta', state: 'GA' },
    { regionId: 10, name: 'Boston', fullName: 'Boston-Cambridge-Newton', state: 'MA' },
    { regionId: 11, name: 'Phoenix', fullName: 'Phoenix-Mesa-Chandler', state: 'AZ' },
    { regionId: 12, name: 'San Francisco', fullName: 'San Francisco-Oakland-Berkeley', state: 'CA' },
    { regionId: 13, name: 'Riverside', fullName: 'Riverside-San Bernardino-Ontario', state: 'CA' },
    { regionId: 14, name: 'Detroit', fullName: 'Detroit-Warren-Dearborn', state: 'MI' },
    { regionId: 15, name: 'Seattle', fullName: 'Seattle-Tacoma-Bellevue', state: 'WA' },
    { regionId: 16, name: 'Minneapolis', fullName: 'Minneapolis-St. Paul-Bloomington', state: 'MN' },
    { regionId: 17, name: 'San Diego', fullName: 'San Diego-Chula Vista-Carlsbad', state: 'CA' },
    { regionId: 18, name: 'Tampa', fullName: 'Tampa-St. Petersburg-Clearwater', state: 'FL' },
    { regionId: 19, name: 'Denver', fullName: 'Denver-Aurora-Lakewood', state: 'CO' },
    { regionId: 20, name: 'St. Louis', fullName: 'St. Louis', state: 'MO' },
    { regionId: 21, name: 'Baltimore', fullName: 'Baltimore-Columbia-Towson', state: 'MD' },
    { regionId: 22, name: 'Orlando', fullName: 'Orlando-Kissimmee-Sanford', state: 'FL' },
    { regionId: 23, name: 'Charlotte', fullName: 'Charlotte-Concord-Gastonia', state: 'NC' },
    { regionId: 24, name: 'San Antonio', fullName: 'San Antonio-New Braunfels', state: 'TX' },
    { regionId: 25, name: 'Portland', fullName: 'Portland-Vancouver-Hillsboro', state: 'OR' },
    { regionId: 26, name: 'Sacramento', fullName: 'Sacramento-Roseville-Folsom', state: 'CA' },
    { regionId: 27, name: 'Pittsburgh', fullName: 'Pittsburgh', state: 'PA' },
    { regionId: 28, name: 'Las Vegas', fullName: 'Las Vegas-Henderson-Paradise', state: 'NV' },
    { regionId: 29, name: 'Austin', fullName: 'Austin-Round Rock-Georgetown', state: 'TX' },
    { regionId: 30, name: 'Cincinnati', fullName: 'Cincinnati', state: 'OH' },
    { regionId: 31, name: 'Kansas City', fullName: 'Kansas City', state: 'MO' },
    { regionId: 32, name: 'Columbus', fullName: 'Columbus', state: 'OH' },
    { regionId: 33, name: 'Indianapolis', fullName: 'Indianapolis-Carmel-Anderson', state: 'IN' },
    { regionId: 34, name: 'Cleveland', fullName: 'Cleveland-Elyria', state: 'OH' },
    { regionId: 35, name: 'San Jose', fullName: 'San Jose-Sunnyvale-Santa Clara', state: 'CA' },
    { regionId: 36, name: 'Nashville', fullName: 'Nashville-Davidson-Murfreesboro-Franklin', state: 'TN' },
    { regionId: 37, name: 'Virginia Beach', fullName: 'Virginia Beach-Norfolk-Newport News', state: 'VA' },
    { regionId: 38, name: 'Providence', fullName: 'Providence-Warwick', state: 'RI' },
    { regionId: 39, name: 'Milwaukee', fullName: 'Milwaukee-Waukesha', state: 'WI' },
    { regionId: 40, name: 'Jacksonville', fullName: 'Jacksonville', state: 'FL' },
    { regionId: 41, name: 'Oklahoma City', fullName: 'Oklahoma City', state: 'OK' },
    { regionId: 42, name: 'Raleigh', fullName: 'Raleigh-Cary', state: 'NC' },
    { regionId: 43, name: 'Memphis', fullName: 'Memphis', state: 'TN' },
    { regionId: 44, name: 'Richmond', fullName: 'Richmond', state: 'VA' },
    { regionId: 45, name: 'Louisville', fullName: 'Louisville-Jefferson County', state: 'KY' },
    { regionId: 46, name: 'New Orleans', fullName: 'New Orleans-Metairie', state: 'LA' },
    { regionId: 47, name: 'Salt Lake City', fullName: 'Salt Lake City', state: 'UT' },
    { regionId: 48, name: 'Hartford', fullName: 'Hartford-East Hartford-Middletown', state: 'CT' },
    { regionId: 49, name: 'Birmingham', fullName: 'Birmingham-Hoover', state: 'AL' },
    { regionId: 50, name: 'Buffalo', fullName: 'Buffalo-Cheektowaga', state: 'NY' },
    { regionId: 51, name: 'Rochester', fullName: 'Rochester', state: 'NY' },
    { regionId: 52, name: 'Grand Rapids', fullName: 'Grand Rapids-Kentwood', state: 'MI' },
    { regionId: 53, name: 'Tucson', fullName: 'Tucson', state: 'AZ' },
    { regionId: 54, name: 'Tulsa', fullName: 'Tulsa', state: 'OK' },
    { regionId: 55, name: 'Fresno', fullName: 'Fresno', state: 'CA' },
    { regionId: 56, name: 'Bridgeport', fullName: 'Bridgeport-Stamford-Norwalk', state: 'CT' },
    { regionId: 57, name: 'Worcester', fullName: 'Worcester', state: 'MA' },
    { regionId: 58, name: 'Albuquerque', fullName: 'Albuquerque', state: 'NM' },
    { regionId: 59, name: 'Omaha', fullName: 'Omaha-Council Bluffs', state: 'NE' },
    { regionId: 60, name: 'Bakersfield', fullName: 'Bakersfield', state: 'CA' },
    { regionId: 61, name: 'Albany', fullName: 'Albany-Schenectady-Troy', state: 'NY' },
    { regionId: 62, name: 'Knoxville', fullName: 'Knoxville', state: 'TN' },
    { regionId: 63, name: 'Baton Rouge', fullName: 'Baton Rouge', state: 'LA' },
    { regionId: 64, name: 'El Paso', fullName: 'El Paso', state: 'TX' },
    { regionId: 65, name: 'Allentown', fullName: 'Allentown-Bethlehem-Easton', state: 'PA' },
    { regionId: 66, name: 'McAllen', fullName: 'McAllen-Edinburg-Mission', state: 'TX' },
    { regionId: 67, name: 'Dayton', fullName: 'Dayton-Kettering', state: 'OH' },
    { regionId: 68, name: 'Columbia', fullName: 'Columbia', state: 'SC' },
    { regionId: 69, name: 'Greensboro', fullName: 'Greensboro-High Point', state: 'NC' },
    { regionId: 70, name: 'Little Rock', fullName: 'Little Rock-North Little Rock-Conway', state: 'AR' },
    { regionId: 71, name: 'Stockton', fullName: 'Stockton', state: 'CA' },
    { regionId: 72, name: 'Syracuse', fullName: 'Syracuse', state: 'NY' },
    { regionId: 73, name: 'Boise', fullName: 'Boise City', state: 'ID' },
    { regionId: 74, name: 'Colorado Springs', fullName: 'Colorado Springs', state: 'CO' },
    { regionId: 75, name: 'Charleston', fullName: 'Charleston-North Charleston', state: 'SC' },
];

// Cache for all metros (loaded once, used for instant filtering)
let metrosCache: Metro[] | null = null;
let metrosLoadingPromise: Promise<Metro[]> | null = null;

// Parse metro name to extract primary state abbreviation
// "Chicago-Naperville-Elgin, IL-IN-WI" -> "IL"
// "Washington" -> ""
function parseMetroState(fullName: string): string {
    const commaIndex = fullName.indexOf(',');
    if (commaIndex < 0) return '';

    const statePart = fullName.substring(commaIndex + 1).trim();
    // Get first state from hyphenated list
    const hyphenIndex = statePart.indexOf('-');
    return hyphenIndex > 0 ? statePart.substring(0, hyphenIndex) : statePart;
}

async function loadAllMetros(): Promise<Metro[]> {
    // Return cached data immediately if available
    if (metrosCache && metrosCache.length > 0) {
        return metrosCache;
    }

    // If a load is in progress, wait for it
    if (metrosLoadingPromise) {
        return metrosLoadingPromise;
    }

    // Try to load from API, fall back to static list on any error
    metrosLoadingPromise = (async () => {
        try {
            const res = await fetch(`${API_BASE_URL}/markets/metros`);
            if (!res.ok) {
                throw new Error(`API returned ${res.status}`);
            }
            const data = await res.json();
            if (Array.isArray(data) && data.length > 0) {
                // Merge with fallback data to ensure we have fullName for search
                const apiMetros = data.map((m: { regionId: number; name: string }) => {
                    // Try to find matching fallback metro for additional fields
                    const fallback = FALLBACK_METROS.find(
                        f => f.name.toLowerCase() === m.name.toLowerCase() ||
                             m.name.toLowerCase().startsWith(f.name.toLowerCase())
                    );
                    return {
                        regionId: m.regionId,
                        name: m.name,
                        fullName: fallback?.fullName || m.name,
                        state: fallback?.state || parseMetroState(m.name),
                    };
                });
                metrosCache = apiMetros;
                return apiMetros;
            }
        } catch (err) {
            console.warn('Metro API unavailable, using fallback list:', err);
        }

        // Fallback to static list
        metrosCache = FALLBACK_METROS;
        return FALLBACK_METROS;
    })();

    return metrosLoadingPromise;
}

export function useGraphSearch(geoLevel?: GeoLevel) {
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
    const [searchLoading, setSearchLoading] = useState(false);
    const [showSearchResults, setShowSearchResults] = useState(false);
    const [metrosLoaded, setMetrosLoaded] = useState(false);
    const searchRef = useRef<HTMLDivElement>(null);

    // Preload metros when metro level is selected
    useEffect(() => {
        if (geoLevel === 'metro' && !metrosLoaded) {
            loadAllMetros().then(() => setMetrosLoaded(true));
        }
    }, [geoLevel, metrosLoaded]);

    // Close search results when clicking outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
                setShowSearchResults(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSearch = useCallback(async (query: string) => {
        setSearchQuery(query);

        if (query.length < 2) {
            setSearchResults([]);
            setShowSearchResults(false);
            return;
        }

        setSearchLoading(true);
        setShowSearchResults(true);

        try {
            // For metro level: use cached data for instant filtering
            if (geoLevel === 'metro') {
                const metros = await loadAllMetros();
                const lowerQuery = query.toLowerCase();

                console.log(`[Metro Search] Query: "${query}", Metros loaded: ${metros.length}`);

                // Search against both name and fullName (for broader matching)
                // e.g., searching "arlington" will find "Washington-Arlington-Alexandria" metro
                const filtered = metros
                    .filter(m => {
                        const nameMatch = m.name?.toLowerCase().includes(lowerQuery);
                        const fullNameMatch = m.fullName?.toLowerCase().includes(lowerQuery);
                        return nameMatch || fullNameMatch;
                    })
                    .slice(0, 10)
                    .map(metro => {
                        const stateAbbrev = metro.state || parseMetroState(metro.name);
                        return {
                            id: `metro-${metro.regionId}`,
                            name: metro.name, // Show full metro name
                            subtitle: stateAbbrev ? `${stateAbbrev} Metro Area` : 'Metro Area',
                            type: 'metro' as const,
                            center: [0, 0] as [number, number],
                            state: stateAbbrev,
                        };
                    });

                console.log(`[Metro Search] Found ${filtered.length} results`);
                setSearchResults(filtered);
                setSearchLoading(false);
                return;
            }

            // For other levels: use Mapbox API
            const mapboxTypes = getMapboxTypes(geoLevel);
            const mapboxResponse = await fetch(
                `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?` +
                `access_token=${MAPBOX_TOKEN}&` +
                `country=US&` +
                `types=${mapboxTypes}&` +
                `limit=8`
            );

            const mapboxData = await mapboxResponse.json();
            const features: MapboxFeature[] = mapboxData.features || [];

            const results: SearchResult[] = features.map((feature: MapboxFeature) => {
                let type: SearchResult['type'] = 'city';
                if (feature.place_type.includes('region')) type = 'state';
                else if (feature.place_type.includes('postcode')) type = 'zip';
                else if (feature.place_type.includes('district')) type = 'county';
                else if (feature.place_type.includes('place')) type = 'city';

                // Extract context for building subtitle
                const stateContext = feature.context?.find((c: MapboxContext) => c.id.startsWith('region'));
                const placeContext = feature.context?.find((c: MapboxContext) => c.id.startsWith('place'));
                const stateAbbrev = stateContext?.short_code?.replace('US-', '') || '';
                const stateName = stateContext?.text || stateAbbrev;

                // Build name and subtitle based on type
                let name = feature.text;
                let subtitle = '';

                if (type === 'zip') {
                    // For ZIP codes: show city name as primary, state + ZIP as subtitle
                    name = placeContext?.text || feature.text;
                    subtitle = `${stateName} ${feature.text}, United States`;
                } else if (type === 'county') {
                    // For counties: show county name, state as subtitle
                    name = feature.text;
                    subtitle = `${stateName}, United States`;
                } else if (type === 'city') {
                    // For cities: show city name, state as subtitle
                    name = feature.text;
                    subtitle = `${stateName}, United States`;
                } else if (type === 'state') {
                    // For states: show state name, country as subtitle
                    name = feature.text;
                    subtitle = 'United States';
                }

                return {
                    id: feature.id,
                    name,
                    subtitle,
                    value: feature.place_name, // Full name for API calls
                    type,
                    center: feature.center,
                    bbox: feature.bbox,
                    state: stateAbbrev,
                };
            });

            setSearchResults(results);
        } catch (err) {
            console.error('Search error:', err);
            setSearchResults([]);
        } finally {
            setSearchLoading(false);
        }
    }, [geoLevel]);

    const clearSearch = () => {
        setSearchQuery('');
        setSearchResults([]);
        setShowSearchResults(false);
    };

    return {
        searchQuery,
        setSearchQuery,
        searchResults,
        searchLoading,
        showSearchResults,
        setShowSearchResults,
        searchRef,
        handleSearch,
        clearSearch
    };
}

// Get appropriate Mapbox types based on geo level
function getMapboxTypes(geoLevel?: GeoLevel): string {
    switch (geoLevel) {
        case 'state':
            return 'region';
        case 'county':
            return 'district';
        case 'city':
            return 'place';
        case 'zip':
            return 'postcode';
        default:
            return 'region,place,postcode,district';
    }
}
