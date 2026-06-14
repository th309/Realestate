/**
 * MARKETS FETCHERS
 *
 * Market stats, AI analysis, snapshot batch, geography search lists,
 * recommendations, social proof, shares.
 */

// Market data (stats, lists, peer markets)
export {
  fetchMarketStats,
  fetchPeers,
  type MarketStats,
  type PeerCandidate,
  type PeersResponse,
} from "../markets";

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

// SEO market stats block (headline stats + score receipts, server-rendered)
export {
  fetchSeoMarketStats,
  assembleMarketStats,
  SEO_MARKET_CACHE_TAG,
  type MarketStatsData,
  type MarketStatField,
  type ScoreReceipt,
  type ReceiptKey,
} from "../market-stats";

// PropertyIQ rankings (same-state by score; state-page tables + related markets)
export { fetchRankings, type RankingRow } from "../rankings";

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
