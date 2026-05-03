/**
 * MARKETS FETCHERS
 *
 * Market stats, AI analysis, snapshot batch, geography search lists,
 * recommendations, social proof, shares.
 */

// Market data (stats, lists)
export { fetchMarketStats, type MarketStats } from "../markets";

// Market AI analysis
export {
  fetchMarketAnalysis,
  type MarketAnalysisSection,
  type MarketAnalysisResult,
} from "../market-analysis";

// Market snapshot (batch)
export {
  fetchMarketSnapshot,
  type MarketSnapshotMetric,
  type MarketSnapshotScoreEntry,
  type MarketSnapshotResponse,
} from "../market-snapshot";

// Recommendations
export {
  fetchMarketsToWatch,
  type MarketRecommendation,
} from "../recommendations";

// Market search lists & geography search
export {
  fetchGeographySearch,
  fetchZipDisplayNames,
  type GeographySearchResult,
  fetchMetrosList,
  fetchCountiesList,
  fetchZipsList,
  fetchCitiesList,
  fetchMarketsMetros,
  fetchMarketsCounties,
  fetchMarketsZips,
  fetchMarketsCities,
} from "../search";

// Shares
export {
  createMarketShare,
  sendMarketShareEmail,
  type CreateMarketShareData,
  type MarketShareResult,
} from "../shares";

// Social proof (engagement stats for geography)
export { fetchSocialProof, type SocialProofStats } from "../social-proof";
