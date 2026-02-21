/**
 * Metric Resolution — public API barrel export.
 */

export { MetricResolutionModule } from './metric-resolution.module';
export { MetricResolutionService } from './metric-resolution.service';
export { GeographyChainService } from './geography-chain.service';
export { SourceFetcherService } from './source-fetcher.service';
export { FALLBACK_REGISTRY, getFallbackChain, getAllRegisteredMetricIds } from './fallback-registry';
export type {
  GeoLevel,
  DataSource,
  ResolvedMetric,
  FallbackSource,
  MetricFallbackChain,
  GeoChainStep,
  GeographyCrosswalkRow,
  TableRoute,
} from './metric-resolution.types';
