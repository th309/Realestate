import { Injectable } from '@nestjs/common';
import { MarketsCoreService } from './internal/markets-core.service';
import { MarketsGeographiesService } from './internal/markets-geographies.service';
import { MarketsHomeValuesService } from './internal/markets-home-values.service';
import { MarketsSearchService } from './internal/markets-search.service';

/**
 * Public facade over the per-domain internal market services. Each method is
 * a thin passthrough so existing callers (controllers, peers, listing
 * presentation, etc.) keep working without changes.
 *
 * Implementation lives in `./internal/*` — split for file-size compliance
 * (CLAUDE.md §1.3). The internal services are providers but NOT exported,
 * so consumers must continue to depend on `MarketsService`.
 */
@Injectable()
export class MarketsService {
  constructor(
    private readonly core: MarketsCoreService,
    private readonly geographies: MarketsGeographiesService,
    private readonly homeValues: MarketsHomeValuesService,
    private readonly search: MarketsSearchService,
  ) {}

  // --- core ---

  getMarketCore(input: { geoLevel: string; geoId: string }) {
    return this.core.getMarketCore(input);
  }

  getMarkets(limit = 100, offset = 0) {
    return this.core.getMarkets(limit, offset);
  }

  getMarketById(id: string) {
    return this.core.getMarketById(id);
  }

  getMarketStats() {
    return this.core.getMarketStats();
  }

  // --- geographies ---

  getStates() {
    return this.geographies.getStates();
  }

  getCountiesByState(stateCode: string) {
    return this.geographies.getCountiesByState(stateCode);
  }

  getMetrosByState(stateCode: string) {
    return this.geographies.getMetrosByState(stateCode);
  }

  // --- home values ---

  getStateHomeValues() {
    return this.homeValues.getStateHomeValues();
  }

  getMetroHomeValues() {
    return this.homeValues.getMetroHomeValues();
  }

  getCountyHomeValues() {
    return this.homeValues.getCountyHomeValues();
  }

  getZipHomeValues() {
    return this.homeValues.getZipHomeValues();
  }

  getStateHomeValuesWithNames() {
    return this.homeValues.getStateHomeValuesWithNames();
  }

  getMetroHomeValuesWithNames() {
    return this.homeValues.getMetroHomeValuesWithNames();
  }

  // --- search / list-all ---

  searchMetros(query: string, limit = 10) {
    return this.search.searchMetros(query, limit);
  }

  getAllMetros() {
    return this.search.getAllMetros();
  }

  getAllCounties() {
    return this.search.getAllCounties();
  }

  getAllZips() {
    return this.search.getAllZips();
  }

  getAllCities() {
    return this.search.getAllCities();
  }
}
