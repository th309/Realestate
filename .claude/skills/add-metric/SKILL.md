---
name: add-metric
description: Scaffold a new metric end-to-end in the PropertyIQ platform — registry, categories, backend endpoint, entitlements gating, and MCP — so it renders as a data card on the map + markets pages and is queryable via MCP. Use when adding a new data metric, connecting a new data source, or tracking a new indicator.
arguments:
  - name: metricId
    description: "The metric identifier in snake_case (e.g. sold_above_list_share)"
    required: true
  - name: dataSource
    description: "Frontend dataSource: zillow, realtor, redfin, census, calculated, fred, propertyiq"
    required: true
  - name: title
    description: "Human-readable title (e.g. 'Sold Above List %')"
    required: true
  - name: format
    description: "Display format: currency, percent, percent_abs, number, index, index_1dec, days"
    required: true
  - name: geos
    description: "Comma-separated supported geos (e.g. 'metro,county,zip')"
    required: true
---

# Add Metric Skill

A metric is only "done" when it renders as a card on BOTH the map and market-detail
pages AND survives entitlement gating. The registry entry alone is not enough — miss
any step below and the card silently does not appear. Work the list in order and
VERIFY on the real page at the end (see "Verify"). Data-value scale matters: Redfin/
Realtor share columns are already 0–100 (`percent_abs`, NO `asPercent`); decimals
like 0.05 need `asPercent: true`.

## 1. Frontend registry (source of truth for format/title/geos)

Add a `MetricConfig` to the right `packages/frontend/lib/data/metrics/<category>.ts`
(composed into `registry.ts` automatically — do NOT edit `registry.ts` directly for
the entry). Required fields: `id, title, format, dataSource, apiEndpoint, keyField:'auto',
supportedGeos, favorableDirection` (`'higher'|'lower'|'neutral'`). Useful optionals:
`coverageNote` (shown in the map legend beside "No data" — use it whenever a source
only covers some regions, e.g. Redfin metro data), `asPercent`, `hasTimeSeries`.

```typescript
sold_above_list_share: {
  id: "sold_above_list_share",
  title: "Sold Above List %",
  format: "percent_abs",
  dataSource: "redfin",
  apiEndpoint: "/api/metrics/redfin-dc/sold_above_list_share/{geo}",
  keyField: "auto",
  supportedGeos: ["metro", "county", "zip"],
  favorableDirection: "neutral",
  hasTimeSeries: false,
  coverageNote: "Redfin reports metro-level figures for major metros only; county/ZIP is broad.",
},
```

- **Metro-only** metrics → also add the id to `METRO_ONLY_METRICS` in `registry.ts`.
- The map's `metric-availability.ts` is auto-generated; new metrics fall back to
  `supportedGeos` until it's regenerated (map still works meanwhile).

## 2. Category (ONE line drives BOTH pages)

Add one `metric("<id>")` line to the right category's `metrics` array in
`packages/frontend/app/(app)/map/config/metric-categories.tsx`. This single edit lists
the metric in the map sidebar/selector AND the market-detail cards (`MarketDashboard`
loops the same categories). Optional polish: add the id to `getMetricCategory` in
`app/(app)/map/components/MetricSelector.tsx` so it groups correctly (else "OTHER").

## 3. Backend

- **Map choropleth** needs a BULK endpoint returning ALL regions for a geo level, at
  the metric's `apiEndpoint`. The generic `resolveMetricForAllGeos` caps at `limit(500)`
  and is NOT usable for the map — you must paginate past Supabase's 1000-row cap. For a
  registry-driven wide-table source, reuse `metrics/redfin-dc-snapshot.{controller,
service}.ts` (resolves `(table,column)` from the fallback registry + `getWideTableRoute`,
  parallel-paginates, scoped to its source). Otherwise clone a bespoke controller
  (`realtor/realtor-price-change.controller.ts`). Response rows must carry `region_id`
  (used as the key fallback for every geo level).
- **Market-detail cards** come from `market-snapshot/market-snapshot.service.ts`
  (`resolveMetricBatch` over a hardcoded list). ADD the new metricId to that list or the
  card never shows on `/market/[id]`.
- **Resolution/routing** — if the metric comes from a wide table not already routed: add
  a `DataSource` in `metric-resolution/metric-resolution.types.ts`, a route in
  `table-routes*.ts`, and a chain in `metric-resolution/fallback-registry/*` (update the
  characterization snapshot: `jest metric-resolution -u`).

## 4. Entitlements gating (THE silent killer)

`getAccess` defaults any metric WITHOUT a `feature_definitions` row to `level:'none'` →
the card is HIDDEN on markets and LOCKED on the map, **even for admin**. Add rows (DB —
config isn't in migrations by convention, but add a `supabase/migrations/*.sql` for
reproducibility and apply it):

```sql
INSERT INTO feature_definitions (slug, name, category, value_type, default_value, is_active, is_enforced)
VALUES ('metric_<id>', '<Title>', 'metrics', 'boolean', 'false'::jsonb, true, true)
ON CONFLICT (slug) DO NOTHING;
-- Pro-gated is the dominant pattern (free=false; pro/enterprise/admin=true):
INSERT INTO tier_features (tier_id, feature_id, value)
SELECT st.id, fd.id, CASE WHEN st.slug='free' THEN 'false'::jsonb ELSE 'true'::jsonb END
FROM feature_definitions fd CROSS JOIN subscription_tiers st
WHERE fd.slug='metric_<id>' AND st.slug IN ('free','pro','enterprise','admin')
  AND NOT EXISTS (SELECT 1 FROM tier_features tf WHERE tf.tier_id=st.id AND tf.feature_id=fd.id);
```

County/ZIP are further geo-gated by the existing `geo_county`/`geo_zip` features — no
per-metric work needed for that.

## 5. MCP (packages/mcp-server)

- **Snapshot**: `get_market_snapshot` proxies `/api/market-snapshot` verbatim — once the
  metric is in the market-snapshot response (step 3), it flows through with NO mcp-server
  change.
- **Timeseries**: `get_market_timeseries` accepts any id but the backend needs a mapping.
  Add the metric to `timeseries/timeseries-metric-mapping.ts` (`{source, columnName}`),
  route its table in `timeseries-region-filter.ts` `getTableName`, add a region-filter
  branch if the table isn't keyed like realtor/zillow (wide `redfin_dc_*` tables key on
  `region_id` + date column `period_end` — see the `redfin_dc` branches), and extend the
  `dateField` ternary in `timeseries.service.ts`. Optional: list the id in the tool
  `.describe()` in `mcp-server/src/tools/core.ts` for discoverability.

## 6. Verify (do NOT skip — typecheck ≠ works)

- `cd packages/backend && npx tsc --noEmit -p tsconfig.build.json`; frontend
  `npx tsc --noEmit`; `jest metric-resolution` if you touched the fallback registry.
- Curl the bulk endpoint + `/api/market-snapshot/<geo>/<id>` and confirm the metric +
  value appear. (nest --watch can wedge and serve stale code — if a new mapping/route
  returns empty but an existing metric works and the DB has data, the dev backend needs a
  restart.)
- Open the REAL page: `/market/<cbsa>` (both Homebuyer/Investor views) and `/map`. New
  metrics are Pro-gated, and the frontend entitlements cache is 30 min + SSR-seeded — use
  `?tier=pro` (dev override, forces a fresh entitlements fetch) to see them immediately.

## Key field reference (map snapshot transform keys)

| Geo    | Key field   | Fallbacks used by transform |
| ------ | ----------- | --------------------------- |
| state  | region_name | region_id                   |
| metro  | cbsa_code   | region_id, location_id      |
| county | county_fips | fips_code, region_id        |
| zip    | postal_code | zip_code, region_id         |

Returning `region_id` on every row works at all levels via these fallbacks.
