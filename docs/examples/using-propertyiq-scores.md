/**
 * Example: Using PropertyIQ Scores in Other Components
 * 
 * The unified data binding layer (fetchMetricData) handles PropertyIQ scores
 * automatically. Just import and call it with the metric ID and geo level.
 */

import { fetchMetricData } from '@/app/map/config/fetchMetricData';
import type { GeoLevel } from '@/app/map/config/metrics';

// Example 1: Fetch InvestorEdge scores for all counties
async function getCountyInvestorEdgeScores() {
  const data = await fetchMetricData('investoredge_score', 'county');
  // Returns: { "01001": { value: 85.2, date: "2025-01-01" }, ... }
  return data;
}

// Example 2: Fetch HomeReady scores for metros in a specific state
async function getMetroHomeReadyScores(state: string) {
  const data = await fetchMetricData('homeready_score', 'metro', { state });
  // Returns: { "12420": { value: 72.5, date: "2025-01-01" }, ... }
  return data;
}

// Example 3: Fetch Market Health scores for ZIP codes
async function getZipMarketHealthScores(state: string) {
  const data = await fetchMetricData('market_health_score', 'zip', { state });
  // Returns: { "78701": { value: 68.3, date: "2025-01-01" }, ... }
  return data;
}

// Example 4: Use in a React component
function MyComponent() {
  const [scores, setScores] = useState<Record<string, { value: number; date?: string }>>({});
  
  useEffect(() => {
    async function loadScores() {
      const data = await fetchMetricData('investoredge_score', 'county');
      setScores(data);
    }
    loadScores();
  }, []);
  
  return (
    <div>
      {Object.entries(scores).map(([fips, entry]) => (
        <div key={fips}>
          FIPS: {fips}, Score: {entry.value}
        </div>
      ))}
    </div>
  );
}

/**
 * What fetchMetricData handles automatically:
 * 
 * 1. ✅ Pagination - Fetches all pages automatically (handles 1000+ records)
 * 2. ✅ FIPS normalization - Converts county FIPS to 5-digit format with leading zeros
 * 3. ✅ Data transformation - Converts API response to unified format
 * 4. ✅ Error handling - Returns empty object on errors
 * 5. ✅ Date handling - Includes "as of" date for display
 * 
 * The returned format is always:
 * {
 *   [key]: { value: number, date?: string }
 * }
 * 
 * Where 'key' is:
 * - County: 5-digit FIPS code (e.g., "01001")
 * - Metro: CBSA code (e.g., "12420")
 * - ZIP: ZIP code (e.g., "78701")
 */
