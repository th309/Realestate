import { useState, useRef, useCallback, useEffect } from 'react';
import type { SearchResult } from '@/app/map/types';
import type { GeoLevel } from '@/app/map/config/metrics';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface Metro {
    regionId: number;
    name: string;
    fullName?: string; // Full census name for searching (e.g., "Washington-Arlington-Alexandria")
    state?: string; // Primary state for display
}

interface County {
    fips: string;
    name: string;
    state: string;
}

interface ZipCode {
    code: string;
    name: string;
}

interface City {
    id: number;
    name: string;
    state: string;
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
    // Additional smaller metros
    { regionId: 76, name: 'Casper', fullName: 'Casper', state: 'WY' },
    { regionId: 77, name: 'Cheyenne', fullName: 'Cheyenne', state: 'WY' },
    { regionId: 78, name: 'Spokane', fullName: 'Spokane-Spokane Valley', state: 'WA' },
    { regionId: 79, name: 'Wichita', fullName: 'Wichita', state: 'KS' },
    { regionId: 80, name: 'Des Moines', fullName: 'Des Moines-West Des Moines', state: 'IA' },
    { regionId: 81, name: 'Madison', fullName: 'Madison', state: 'WI' },
    { regionId: 82, name: 'Lexington', fullName: 'Lexington-Fayette', state: 'KY' },
    { regionId: 83, name: 'Chattanooga', fullName: 'Chattanooga', state: 'TN' },
    { regionId: 84, name: 'Provo', fullName: 'Provo-Orem', state: 'UT' },
    { regionId: 85, name: 'Ogden', fullName: 'Ogden-Clearfield', state: 'UT' },
    { regionId: 86, name: 'Huntsville', fullName: 'Huntsville', state: 'AL' },
    { regionId: 87, name: 'Mobile', fullName: 'Mobile', state: 'AL' },
    { regionId: 88, name: 'Shreveport', fullName: 'Shreveport-Bossier City', state: 'LA' },
    { regionId: 89, name: 'Pensacola', fullName: 'Pensacola-Ferry Pass-Brent', state: 'FL' },
    { regionId: 90, name: 'Savannah', fullName: 'Savannah', state: 'GA' },
    { regionId: 91, name: 'Greenville', fullName: 'Greenville-Anderson', state: 'SC' },
    { regionId: 92, name: 'Fayetteville', fullName: 'Fayetteville-Springdale-Rogers', state: 'AR' },
    { regionId: 93, name: 'Akron', fullName: 'Akron', state: 'OH' },
    { regionId: 94, name: 'Toledo', fullName: 'Toledo', state: 'OH' },
    { regionId: 95, name: 'Durham', fullName: 'Durham-Chapel Hill', state: 'NC' },
    { regionId: 96, name: 'Cape Coral', fullName: 'Cape Coral-Fort Myers', state: 'FL' },
    { regionId: 97, name: 'Lakeland', fullName: 'Lakeland-Winter Haven', state: 'FL' },
    { regionId: 98, name: 'Sarasota', fullName: 'Sarasota-Bradenton', state: 'FL' },
    { regionId: 99, name: 'Palm Bay', fullName: 'Palm Bay-Melbourne-Titusville', state: 'FL' },
    { regionId: 100, name: 'Deltona', fullName: 'Deltona-Daytona Beach-Ormond Beach', state: 'FL' },
    { regionId: 101, name: 'North Port', fullName: 'North Port-Sarasota-Bradenton', state: 'FL' },
    { regionId: 102, name: 'Modesto', fullName: 'Modesto', state: 'CA' },
    { regionId: 103, name: 'Oxnard', fullName: 'Oxnard-Thousand Oaks-Ventura', state: 'CA' },
    { regionId: 104, name: 'Santa Rosa', fullName: 'Santa Rosa-Petaluma', state: 'CA' },
    { regionId: 105, name: 'Visalia', fullName: 'Visalia', state: 'CA' },
    { regionId: 106, name: 'Salem', fullName: 'Salem', state: 'OR' },
    { regionId: 107, name: 'Eugene', fullName: 'Eugene-Springfield', state: 'OR' },
    { regionId: 108, name: 'Fort Collins', fullName: 'Fort Collins', state: 'CO' },
    { regionId: 109, name: 'Reno', fullName: 'Reno', state: 'NV' },
    { regionId: 110, name: 'Anchorage', fullName: 'Anchorage', state: 'AK' },
    { regionId: 111, name: 'Honolulu', fullName: 'Honolulu', state: 'HI' },
    { regionId: 112, name: 'Springfield', fullName: 'Springfield', state: 'MO' },
    { regionId: 113, name: 'Youngstown', fullName: 'Youngstown-Warren-Boardman', state: 'OH' },
    { regionId: 114, name: 'Scranton', fullName: 'Scranton-Wilkes-Barre', state: 'PA' },
    { regionId: 115, name: 'Harrisburg', fullName: 'Harrisburg-Carlisle', state: 'PA' },
    { regionId: 116, name: 'Lancaster', fullName: 'Lancaster', state: 'PA' },
    { regionId: 117, name: 'Reading', fullName: 'Reading', state: 'PA' },
    { regionId: 118, name: 'Winston-Salem', fullName: 'Winston-Salem', state: 'NC' },
    { regionId: 119, name: 'Asheville', fullName: 'Asheville', state: 'NC' },
    { regionId: 120, name: 'Fargo', fullName: 'Fargo', state: 'ND' },
    { regionId: 121, name: 'Sioux Falls', fullName: 'Sioux Falls', state: 'SD' },
    { regionId: 122, name: 'Billings', fullName: 'Billings', state: 'MT' },
    { regionId: 123, name: 'Missoula', fullName: 'Missoula', state: 'MT' },
    { regionId: 124, name: 'Lincoln', fullName: 'Lincoln', state: 'NE' },
    { regionId: 125, name: 'Topeka', fullName: 'Topeka', state: 'KS' },
    { regionId: 126, name: 'Cedar Rapids', fullName: 'Cedar Rapids', state: 'IA' },
    { regionId: 127, name: 'Davenport', fullName: 'Davenport-Moline-Rock Island', state: 'IA' },
    { regionId: 128, name: 'Green Bay', fullName: 'Green Bay', state: 'WI' },
    { regionId: 129, name: 'Appleton', fullName: 'Appleton', state: 'WI' },
    { regionId: 130, name: 'Duluth', fullName: 'Duluth', state: 'MN' },
    { regionId: 131, name: 'Peoria', fullName: 'Peoria', state: 'IL' },
    { regionId: 132, name: 'Rockford', fullName: 'Rockford', state: 'IL' },
    { regionId: 133, name: 'South Bend', fullName: 'South Bend-Mishawaka', state: 'IN' },
    { regionId: 134, name: 'Fort Wayne', fullName: 'Fort Wayne', state: 'IN' },
    { regionId: 135, name: 'Evansville', fullName: 'Evansville', state: 'IN' },
    { regionId: 136, name: 'Lansing', fullName: 'Lansing-East Lansing', state: 'MI' },
    { regionId: 137, name: 'Ann Arbor', fullName: 'Ann Arbor', state: 'MI' },
    { regionId: 138, name: 'Flint', fullName: 'Flint', state: 'MI' },
    { regionId: 139, name: 'Kalamazoo', fullName: 'Kalamazoo-Portage', state: 'MI' },
    { regionId: 140, name: 'Canton', fullName: 'Canton-Massillon', state: 'OH' },
];

// Caches for client-side filtering (loaded once per session)
let metrosCache: Metro[] | null = null;
let metrosLoadingPromise: Promise<Metro[]> | null = null;

let countiesCache: County[] | null = null;
let countiesLoadingPromise: Promise<County[]> | null = null;

let zipsCache: ZipCode[] | null = null;
let zipsLoadingPromise: Promise<ZipCode[]> | null = null;

let citiesCache: City[] | null = null;
let citiesLoadingPromise: Promise<City[]> | null = null;

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
    // Minimum threshold - API should return at least 10 metros to be considered valid
    const MIN_METRO_COUNT = 10;

    metrosLoadingPromise = (async () => {
        try {
            const res = await fetch(`${API_BASE_URL}/markets/metros`);
            if (!res.ok) {
                throw new Error(`API returned ${res.status}`);
            }
            const data = await res.json();

            // Only use API data if it has a reasonable number of metros
            if (Array.isArray(data) && data.length >= MIN_METRO_COUNT) {
                console.log(`[Metro Load] API returned ${data.length} metros, using API data`);
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
            } else {
                console.warn(`[Metro Load] API returned only ${data?.length || 0} metros, using fallback list`);
            }
        } catch (err) {
            console.warn('[Metro Load] API unavailable, using fallback list:', err);
        }

        // Fallback to static list (140 metros with full search data)
        console.log(`[Metro Load] Using fallback list with ${FALLBACK_METROS.length} metros`);
        metrosCache = FALLBACK_METROS;
        return FALLBACK_METROS;
    })();

    return metrosLoadingPromise;
}

async function loadAllCounties(): Promise<County[]> {
    if (countiesCache && countiesCache.length > 0) {
        return countiesCache;
    }

    if (countiesLoadingPromise) {
        return countiesLoadingPromise;
    }

    countiesLoadingPromise = (async () => {
        try {
            const res = await fetch(`${API_BASE_URL}/markets/counties`);
            if (!res.ok) {
                throw new Error(`API returned ${res.status}`);
            }
            const data = await res.json();

            if (Array.isArray(data) && data.length > 0) {
                console.log(`[County Load] API returned ${data.length} counties`);
                countiesCache = data;
                return data;
            }
        } catch (err) {
            console.warn('[County Load] API unavailable:', err);
        }

        countiesCache = [];
        return [];
    })();

    return countiesLoadingPromise;
}

async function loadAllZips(): Promise<ZipCode[]> {
    if (zipsCache && zipsCache.length > 0) {
        return zipsCache;
    }

    if (zipsLoadingPromise) {
        return zipsLoadingPromise;
    }

    zipsLoadingPromise = (async () => {
        try {
            const res = await fetch(`${API_BASE_URL}/markets/zips`);
            if (!res.ok) {
                throw new Error(`API returned ${res.status}`);
            }
            const data = await res.json();

            if (Array.isArray(data) && data.length > 0) {
                console.log(`[ZIP Load] API returned ${data.length} ZIP codes`);
                zipsCache = data;
                return data;
            }
        } catch (err) {
            console.warn('[ZIP Load] API unavailable:', err);
        }

        zipsCache = [];
        return [];
    })();

    return zipsLoadingPromise;
}

async function loadAllCities(): Promise<City[]> {
    if (citiesCache && citiesCache.length > 0) {
        return citiesCache;
    }

    if (citiesLoadingPromise) {
        return citiesLoadingPromise;
    }

    citiesLoadingPromise = (async () => {
        try {
            const res = await fetch(`${API_BASE_URL}/markets/cities`);
            if (!res.ok) {
                throw new Error(`API returned ${res.status}`);
            }
            const data = await res.json();

            if (Array.isArray(data) && data.length > 0) {
                console.log(`[City Load] API returned ${data.length} cities`);
                citiesCache = data;
                return data;
            }
        } catch (err) {
            console.warn('[City Load] API unavailable:', err);
        }

        citiesCache = [];
        return [];
    })();

    return citiesLoadingPromise;
}

export function useGraphSearch(geoLevel?: GeoLevel) {
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
    const [searchLoading, setSearchLoading] = useState(false);
    const [showSearchResults, setShowSearchResults] = useState(false);
    const [dataLoaded, setDataLoaded] = useState<Record<string, boolean>>({});
    const searchRef = useRef<HTMLDivElement>(null);

    // Preload data when geo level is selected
    useEffect(() => {
        if (geoLevel === 'metro' && !dataLoaded.metro) {
            loadAllMetros().then(() => setDataLoaded(prev => ({ ...prev, metro: true })));
        } else if (geoLevel === 'county' && !dataLoaded.county) {
            loadAllCounties().then(() => setDataLoaded(prev => ({ ...prev, county: true })));
        } else if (geoLevel === 'zip' && !dataLoaded.zip) {
            loadAllZips().then(() => setDataLoaded(prev => ({ ...prev, zip: true })));
        } else if (geoLevel === 'city' && !dataLoaded.city) {
            loadAllCities().then(() => setDataLoaded(prev => ({ ...prev, city: true })));
        }
    }, [geoLevel, dataLoaded]);

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
        console.log(`[Search] handleSearch called with query="${query}", geoLevel="${geoLevel}"`);
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
            console.log(`[Search] Checking geoLevel: "${geoLevel}" === "metro" ? ${geoLevel === 'metro'}`);
            if (geoLevel === 'metro') {
                const metros = await loadAllMetros();
                const lowerQuery = query.toLowerCase();

                console.log(`[Metro Search] Query: "${query}", Metros loaded: ${metros.length}`);

                // Search against both name and fullName (for broader matching)
                // Prioritize: 1) starts with query, 2) word starts with query, 3) contains query
                const scored = metros
                    .map(m => {
                        const name = m.name?.toLowerCase() || '';
                        const fullName = m.fullName?.toLowerCase() || '';

                        // Score: higher = better match
                        let score = 0;
                        if (name.startsWith(lowerQuery)) score = 100; // Exact start match
                        else if (fullName.startsWith(lowerQuery)) score = 90;
                        else if (name.split(/[-\s]/).some(word => word.startsWith(lowerQuery))) score = 80; // Word starts with
                        else if (fullName.split(/[-\s]/).some(word => word.startsWith(lowerQuery))) score = 70;
                        else if (name.includes(lowerQuery)) score = 50; // Contains anywhere
                        else if (fullName.includes(lowerQuery)) score = 40;

                        return { metro: m, score };
                    })
                    .filter(({ score }) => score > 0)
                    .sort((a, b) => b.score - a.score)
                    .slice(0, 10);

                const filtered = scored.map(({ metro }) => {
                        const stateAbbrev = metro.state || parseMetroState(metro.name);
                        // Show full census name (e.g., "Los Angeles-Long Beach-Anaheim")
                        const displayName = metro.fullName || metro.name;
                        return {
                            id: `metro-${metro.regionId}`,
                            name: displayName,
                            subtitle: stateAbbrev ? `${stateAbbrev} Metro Area` : 'Metro Area',
                            value: metro.name, // Use short name for API calls
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

            // For county level: use cached data for instant filtering
            if (geoLevel === 'county') {
                const counties = await loadAllCounties();
                const lowerQuery = query.toLowerCase();

                console.log(`[County Search] Query: "${query}", Counties loaded: ${counties.length}`);

                const scored = counties
                    .map(c => {
                        const name = c.name?.toLowerCase() || '';
                        const state = c.state?.toLowerCase() || '';

                        let score = 0;
                        if (name.startsWith(lowerQuery)) score = 100;
                        else if (name.split(/[\s-]/).some(word => word.startsWith(lowerQuery))) score = 80;
                        else if (name.includes(lowerQuery)) score = 50;
                        else if (state.startsWith(lowerQuery)) score = 30;

                        return { county: c, score };
                    })
                    .filter(({ score }) => score > 0)
                    .sort((a, b) => b.score - a.score)
                    .slice(0, 10);

                const filtered = scored.map(({ county }) => ({
                    id: `county-${county.fips}`,
                    name: county.name,
                    subtitle: county.state ? `${county.state} County` : 'County',
                    // Include state to disambiguate counties with same name (e.g., "Cook, IL" vs "Cook, MN")
                    value: county.state ? `${county.name}, ${county.state}` : county.name,
                    type: 'county' as const,
                    center: [0, 0] as [number, number],
                    state: county.state,
                }));

                console.log(`[County Search] Found ${filtered.length} results`);
                setSearchResults(filtered);
                setSearchLoading(false);
                return;
            }

            // For ZIP level: use cached data for instant filtering
            if (geoLevel === 'zip') {
                const zips = await loadAllZips();
                const lowerQuery = query.toLowerCase();

                console.log(`[ZIP Search] Query: "${query}", ZIPs loaded: ${zips.length}`);

                const scored = zips
                    .map(z => {
                        const code = z.code?.toLowerCase() || '';
                        const name = z.name?.toLowerCase() || '';

                        let score = 0;
                        if (code.startsWith(lowerQuery)) score = 100; // ZIP code starts with query
                        else if (name.startsWith(lowerQuery)) score = 90; // City name starts with query
                        else if (name.split(/[\s,]/).some(word => word.startsWith(lowerQuery))) score = 70;
                        else if (code.includes(lowerQuery)) score = 50;
                        else if (name.includes(lowerQuery)) score = 40;

                        return { zip: z, score };
                    })
                    .filter(({ score }) => score > 0)
                    .sort((a, b) => b.score - a.score)
                    .slice(0, 10);

                const filtered = scored.map(({ zip }) => ({
                    id: `zip-${zip.code}`,
                    name: zip.name || zip.code,
                    subtitle: `ZIP ${zip.code}`,
                    value: zip.code, // Use ZIP code for API calls
                    type: 'zip' as const,
                    center: [0, 0] as [number, number],
                    state: '',
                }));

                console.log(`[ZIP Search] Found ${filtered.length} results`);
                setSearchResults(filtered);
                setSearchLoading(false);
                return;
            }

            // For city level: use cached data for instant filtering
            if (geoLevel === 'city') {
                const cities = await loadAllCities();
                const lowerQuery = query.toLowerCase();

                console.log(`[City Search] Query: "${query}", Cities loaded: ${cities.length}`);

                const scored = cities
                    .map(c => {
                        const name = c.name?.toLowerCase() || '';
                        const state = c.state?.toLowerCase() || '';

                        let score = 0;
                        if (name.startsWith(lowerQuery)) score = 100;
                        else if (name.split(/[\s-]/).some(word => word.startsWith(lowerQuery))) score = 80;
                        else if (name.includes(lowerQuery)) score = 50;
                        else if (state.startsWith(lowerQuery)) score = 30;

                        return { city: c, score };
                    })
                    .filter(({ score }) => score > 0)
                    .sort((a, b) => b.score - a.score)
                    .slice(0, 10);

                const filtered = scored.map(({ city }) => ({
                    id: `city-${city.id}`,
                    name: city.name,
                    subtitle: city.state ? `${city.state}, United States` : 'United States',
                    // Include state to disambiguate cities with same name (e.g., "Miami, FL" vs "Miami, OK")
                    value: city.state ? `${city.name}, ${city.state}` : city.name,
                    type: 'city' as const,
                    center: [0, 0] as [number, number],
                    state: city.state,
                }));

                console.log(`[City Search] Found ${filtered.length} results`);
                setSearchResults(filtered);
                setSearchLoading(false);
                return;
            }

            // Fallback: no results for unknown geo levels
            setSearchResults([]);
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
