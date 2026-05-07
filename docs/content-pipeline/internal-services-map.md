# Internal Services Map

Generated 2026-04-28. Maps MCP tool names to internal PropertyIQ NestJS services/endpoints that `ContentDataService` can call directly, bypassing the MCP HTTP layer.

## P1 tools

| MCP tool             | HTTP endpoint                                      | NestJS controller                | Service.method                | Notes |
| -------------------- | ------------------------------------------------- | -------------------------------- | ----------------------------- | ----- |
| search_markets       | `GET /api/scores/search?q=...&geography=...`       | `ScoringController`              | `ScoringService.searchMarkets`| MCP tools call scores search today. |
| get_market_snapshot  | `GET /api/market-snapshot/:geoType/:geoId`         | `MarketSnapshotController`       | `MarketSnapshotService.getSnapshot` | Aggregates metric snapshot. |
| get_propertyiq_score | `GET /api/scores/:geography/:locationId`           | `ScoringController`              | `ScoringService.getScore*`    | MCP uses legacy path endpoint. |
| get_trending_markets | `GET /api/scores/top?geography=...&score_type=...`  | `ScoringController`              | `ScoringService.getTopMarkets`| “Trending” is currently approximated by top/bottom pulls. |
| top_cashflow_markets | (TBD)                                               | (TBD)                            | (TBD)                         | Requires tracing MCP tool file. |

## P2 tools

| MCP tool                   | HTTP endpoint                                           | NestJS controller          | Service.method | Notes |
| ------------------------- | ------------------------------------------------------ | -------------------------- | -------------- | ----- |
| compare_markets_for_content | `GET /api/market-snapshot/...` + `GET /api/scores/...` | `MarketSnapshotController` + `ScoringController` | various | MCP tool composes 2 markets via these endpoints. |

## P3 tools

| MCP tool                        | HTTP endpoint(s)                                                                 | NestJS controller(s)                                  | Service.method(s)                             | Notes |
| ------------------------------ | ------------------------------------------------------------------------------- | ----------------------------------------------------- | --------------------------------------------- | ----- |
| farm_area_analysis             | `GET /api/market-snapshot/zip/:zip` + `GET /api/scores/zip/:zip`                | `MarketSnapshotController`, `ScoringController`        | `MarketSnapshotService.getSnapshot`, `ScoringService.getScore*` | MCP aggregates across ZIP list; could be lifted into a backend service later. |
| brokerage_market_coverage_report | `GET /api/market-snapshot/:geo/:id` + `GET /api/scores/:geo/:id`              | `MarketSnapshotController`, `ScoringController`        | same as above                                  | MCP loops IDs; “executive brief” is prompt-layer. |
| agent_recruitment_pitch        | `GET /api/market-snapshot/:geo/:id` + `GET /api/scores/:geo/:id?historyMonths=3` | `MarketSnapshotController`, `ScoringController`      | same as above                                  | Prompt-layer pitch generation. |
| referral_network_finder        | `GET /api/scores/top?...` + `GET /api/v1/rankings/propertyiq/:geo?order=asc...` | `ScoringController`, `RankingsV1Controller`            | `ScoringService.getTopMarkets`, rankings query | Rankings endpoint requires API key auth when called externally; MCP server can call it with its internal key. |
| generate_market_narrative      | `GET /api/market-snapshot/...` + `GET /api/scores/...` + `GET /api/timeseries/home_value/...` | `MarketSnapshotController`, `ScoringController`, `TimeSeriesController` | `MarketSnapshotService.getSnapshot`, `ScoringService.getScore*`, `TimeSeriesService.getTimeSeries` | Narrative is prompt-layer; the data endpoints are the key dependencies. |
| compare_markets_for_content    | `GET /api/market-snapshot/...` + `GET /api/scores/...`                          | `MarketSnapshotController`, `ScoringController`        | various                                        | Duplicated in P2 section, included here for completeness. |

## Gaps

- **top_cashflow_markets**: not traced in this file yet (tool exists elsewhere). If logic is MCP-only, decide whether to lift into a backend service or call MCP HTTP directly from `ContentDataService`.

