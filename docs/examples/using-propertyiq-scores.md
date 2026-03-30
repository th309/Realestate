/\*\*

- Example: Using PropertyIQ Scores in Other Components
-
- The unified data binding layer handles PropertyIQ scores automatically.
- As of March 2026, PropertyIQ uses a single score type ('propertyiq')
- that measures market demand signal relative to state average.
-
- Score formula: signal = z(sold_above_list) - z(median_dom) - z(months_of_supply)
- → percentile rank within state → re-center at 55.6 → clamp 1-99
- 50 = state average; higher = outperformance.
  \*/

import { fetchScore, useScoreData } from '@/lib/data';
import type { GeoLevel } from '@/app/map/config/metrics';

// Example 1: Fetch PropertyIQ score for a specific metro
async function getMetroScore(cbsaCode: string) {
const score = await fetchScore('metro', cbsaCode);
// Returns: { score: 72.5, confidence: 85, score_type: 'propertyiq', ... }
return score;
}

// Example 2: Fetch PropertyIQ score for a county
async function getCountyScore(countyFips: string) {
const score = await fetchScore('county', countyFips);
// Returns: { score: 68.3, confidence: 70, score_type: 'propertyiq', ... }
return score;
}

// Example 3: Use the ScoreWidget component (preferred)
// ScoreWidget auto-fetches the score and displays it with confidence badge
import { ScoreWidget } from '@/app/components/scoring/ScoreWidget';

function MarketHeader({ geoLevel, geoId }: { geoLevel: GeoLevel; geoId: string }) {
return (
<div>
<ScoreWidget geoLevel={geoLevel} geoId={geoId} />
</div>
);
}

// Example 4: Use the useScoreData hook in a custom component
function CustomScoreDisplay({ geoLevel, geoId }: { geoLevel: GeoLevel; geoId: string }) {
const { data: score, isLoading } = useScoreData(geoLevel, geoId);

if (isLoading) return <div>Loading...</div>;
if (!score) return <div>No score available</div>;

return (
<div>
<span>PropertyIQ Score: {score.score}</span>
<span>Confidence: {score.confidence}%</span>
</div>
);
}

/\*\*

- What the data layer handles automatically:
-
- 1.  Single score type - always fetches score_type='propertyiq'
- 2.  Confidence rating - A/B/C/F letter grade based on data quality
- 3.  Score labels - EXCELLENT/GREAT/GOOD/FAIR/AVERAGE/BELOW AVG/POOR/VERY POOR
- 4.  Score colors - via getScoreColor() utility
- 5.  Error handling - returns null on errors
-
- Coverage: 746 metros, 2,983 counties, 19,880 ZIPs
- Database: propertyiq_scores table, score_type = 'propertyiq'
  \*/
