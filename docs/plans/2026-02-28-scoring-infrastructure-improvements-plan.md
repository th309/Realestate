> **ARCHIVED:** This document describes the legacy 3-score system (HomeReady, InvestorEdge, MarketHealth) which was replaced by a single PropertyIQ Score in March 2026. See `docs/superpowers/specs/2026-03-29-propertyiq-single-score-redesign.md` for the current system.

# Scoring Infrastructure Improvements Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Extend the outcome pipeline's cache preloader to bulk-load all data sources (Redfin, Realtor, ZORI), wire ZORI rent data through the outcome pipeline with ACS fallback, and apply isotonic calibration to reduce MAD below 15 pp.

**Architecture:** Three sequential improvements to the scoring/backtest pipeline. Task 1 extends the in-memory cache. Task 2 wires rent data through the existing outcome generator. Task 3 adds a Python-trained isotonic calibration layer between score normalization and persistence.

**Tech Stack:** NestJS (backend), Python/scikit-learn (calibration training), Supabase (PostgreSQL)

---

## Task 1: Extend Cache Preloader — Load ZORI Alongside ZHVI

**Files:**

- Modify: `packages/backend/src/scoring/backtest/outcome-cache.service.ts:120-202`

**Context:** `preloadHistoricalData()` currently queries `zillow_*` tables with `.eq('metric_name', 'zhvi')`. ZORI lives in the same tables under `metric_name = 'zori'`. We widen the filter and merge ZORI values into the existing `HistoricalDataPoint`.

**Step 1: Update preloadHistoricalData to load both ZHVI and ZORI**

In `outcome-cache.service.ts`, change the select and filter in `preloadHistoricalData()`. Replace:

```typescript
let query = client
  .from(table)
  .select(`${idCol}, period_date, value, state_code`)
  .eq("metric_name", "zhvi");
```

With:

```typescript
let query = client
  .from(table)
  .select(`${idCol}, period_date, value, state_code, metric_name`)
  .in("metric_name", ["zhvi", "zori"]);
```

Then update the row processing loop. Replace:

```typescript
const histKey = `${indexKey}:${date}`;
if (!this.historicalCache.has(histKey)) {
  this.historicalCache.set(histKey, [
    { date, zhvi: row.value as number, source: "zillow" },
  ]);
  loaded++;
}
```

With:

```typescript
const histKey = `${indexKey}:${date}`;
const metricName = row.metric_name as string;
const existing = this.historicalCache.get(histKey);

if (existing) {
  // Merge ZORI into existing ZHVI point (or vice versa)
  if (metricName === "zori") {
    existing[0].zori = row.value as number;
  } else {
    existing[0].zhvi = row.value as number;
  }
} else {
  const point: HistoricalDataPoint = {
    date,
    source: "zillow",
  };
  if (metricName === "zori") {
    point.zori = row.value as number;
  } else {
    point.zhvi = row.value as number;
  }
  this.historicalCache.set(histKey, [point]);
  loaded++;
}
```

**Step 2: Update the preload log message**

Replace:

```typescript
console.log(
  `    Preloaded ${loaded.toLocaleString()} historical points + ${this.stateCodeCache.size} state codes for ${geographyType}`,
);
```

With:

```typescript
console.log(
  `    Preloaded ${loaded.toLocaleString()} historical points (ZHVI + ZORI) + ${this.stateCodeCache.size} state codes for ${geographyType}`,
);
```

**Step 3: Update populate-outcomes.ts log message**

In `packages/backend/src/scripts/populate-outcomes.ts`, line 97, replace:

```typescript
console.log(`  Pre-loading all Zillow ZHVI for ${geography}...`);
```

With:

```typescript
console.log(`  Pre-loading all Zillow ZHVI + ZORI for ${geography}...`);
```

**Step 4: Verify cache diagnostic shows ZORI**

In `populate-outcomes.ts`, after the existing cache test (line 107-110), add a ZORI diagnostic:

```typescript
const testZori = cacheService.lookupHistorical("metro", "31080", "2021-02-01");
console.log(
  `  Cache test ZORI (metro:31080:2021-02-01): ${testZori === undefined ? "MISS" : testZori === null ? "null" : `zori=${testZori[0]?.zori ?? "undefined"}`}`,
);
```

**Step 5: Commit**

```bash
git add packages/backend/src/scoring/backtest/outcome-cache.service.ts packages/backend/src/scripts/populate-outcomes.ts
git commit -m "feat(scoring): extend cache preloader to bulk-load ZORI alongside ZHVI"
```

---

## Task 2: Add Redfin Cache + Preload Method

**Files:**

- Modify: `packages/backend/src/scoring/backtest/outcome-cache.service.ts`

**Context:** Redfin data lives in `redfin_[metro|county|zip]` tables. We add a separate cache (keyed differently from Zillow) and a preload method using the same keyset pagination pattern.

**Step 1: Add Redfin cache maps and lookup method**

In `outcome-cache.service.ts`, after the existing cache declarations (line 35), add:

```typescript
  /** Redfin price data keyed by "geoType:geoId:date" */
  readonly redfinCache = new Map<string, { date: string; price: number } | null>();

  /** Sorted date index per Redfin geography: "geoType:geoId" → sorted dates */
  private readonly redfinDateIndex = new Map<string, string[]>();
```

Add a lookup method after `lookupBenchmark()`:

```typescript
  /**
   * Look up Redfin price for the nearest date <= requested.
   * Returns undefined if the geo wasn't preloaded.
   */
  lookupRedfin(
    geoType: GeographyType,
    geoId: string,
    requestedDate: string,
  ): { date: string; price: number } | null | undefined {
    const exactKey = `${geoType}:${geoId}:${requestedDate}`;
    if (this.redfinCache.has(exactKey))
      return this.redfinCache.get(exactKey)!;

    const indexKey = `${geoType}:${geoId}`;
    const dates = this.redfinDateIndex.get(indexKey);
    if (!dates) return undefined;

    const nearestDate = this.binarySearchFloor(dates, requestedDate);
    if (!nearestDate) return null;

    const cacheKey = `${geoType}:${geoId}:${nearestDate}`;
    return this.redfinCache.get(cacheKey) ?? null;
  }
```

**Step 2: Add preloadRedfinData method**

Add after `preloadBenchmarkData()`:

```typescript
  /**
   * Bulk-load Redfin median_sale_price for a geography type.
   * Only metro, county, zip are supported (state returns 0).
   */
  async preloadRedfinData(geographyType: GeographyType): Promise<number> {
    const route = getRedfinRoute(geographyType);
    if (!route) {
      this.logger.log(`No Redfin data for ${geographyType}, skipping preload`);
      return 0;
    }

    const client = this.supabase.getClient();
    let loaded = 0;
    const pageSize = 1000;
    const geoDateSets = new Map<string, Set<string>>();

    let offset = 0;

    while (true) {
      const { data } = (await client
        .from(route.table)
        .select(`${route.idColumn}, ${route.dateColumn}, median_sale_price`)
        .eq('property_type', 'All Residential')
        .not('median_sale_price', 'is', null)
        .order(route.idColumn, { ascending: true })
        .order(route.dateColumn, { ascending: true })
        .range(offset, offset + pageSize - 1)) as {
        data: Record<string, any>[] | null;
      };

      if (!data || data.length === 0) break;

      for (const row of data) {
        const geoId = String(row[route.idColumn]);
        const date = String(row[route.dateColumn]);
        const cacheKey = `${geographyType}:${geoId}:${date}`;

        if (!this.redfinCache.has(cacheKey)) {
          this.redfinCache.set(cacheKey, {
            date,
            price: row.median_sale_price as number,
          });
          loaded++;
        }

        const indexKey = `${geographyType}:${geoId}`;
        let dateSet = geoDateSets.get(indexKey);
        if (!dateSet) {
          dateSet = new Set<string>();
          geoDateSets.set(indexKey, dateSet);
        }
        dateSet.add(date);
      }

      if (loaded % 50000 === 0 && loaded > 0) {
        console.log(
          `    ... ${loaded.toLocaleString()} Redfin rows loaded from ${route.table}`,
        );
      }

      if (data.length < pageSize) break;
      offset += pageSize;
    }

    for (const [key, dates] of geoDateSets) {
      this.redfinDateIndex.set(key, [...dates].sort());
    }

    console.log(
      `    Preloaded ${loaded.toLocaleString()} Redfin price points for ${geographyType}`,
    );
    return loaded;
  }
```

**Step 3: Add import for getRedfinRoute and getRealtorRoute**

Update the import at the top of `outcome-cache.service.ts`:

```typescript
import {
  getZillowTable,
  getZillowIdColumn,
  getRedfinRoute,
  getRealtorRoute,
} from "./outcome-generator.types";
```

**Step 4: Update clearAll()**

Add the new caches to `clearAll()`:

```typescript
  clearAll(): void {
    this.benchmarkCache.clear();
    this.stateCodeCache.clear();
    this.historicalCache.clear();
    this.historicalDateIndex.clear();
    this.benchmarkDateIndex.clear();
    this.redfinCache.clear();
    this.redfinDateIndex.clear();
  }
```

**Step 5: Commit**

```bash
git add packages/backend/src/scoring/backtest/outcome-cache.service.ts
git commit -m "feat(scoring): add Redfin cache and bulk preload method"
```

---

## Task 3: Add Realtor Cache + Preload Method

**Files:**

- Modify: `packages/backend/src/scoring/backtest/outcome-cache.service.ts`

**Step 1: Add Realtor cache maps and lookup method**

After the Redfin cache declarations, add:

```typescript
  /** Realtor price data keyed by "geoType:geoId:date" */
  readonly realtorCache = new Map<string, { date: string; price: number } | null>();

  /** Sorted date index per Realtor geography: "geoType:geoId" → sorted dates */
  private readonly realtorDateIndex = new Map<string, string[]>();
```

Add lookup method:

```typescript
  /**
   * Look up Realtor price for the nearest date <= requested.
   * Returns undefined if the geo wasn't preloaded.
   */
  lookupRealtor(
    geoType: GeographyType,
    geoId: string,
    requestedDate: string,
  ): { date: string; price: number } | null | undefined {
    const exactKey = `${geoType}:${geoId}:${requestedDate}`;
    if (this.realtorCache.has(exactKey))
      return this.realtorCache.get(exactKey)!;

    const indexKey = `${geoType}:${geoId}`;
    const dates = this.realtorDateIndex.get(indexKey);
    if (!dates) return undefined;

    const nearestDate = this.binarySearchFloor(dates, requestedDate);
    if (!nearestDate) return null;

    const cacheKey = `${geoType}:${geoId}:${nearestDate}`;
    return this.realtorCache.get(cacheKey) ?? null;
  }
```

**Step 2: Add preloadRealtorData method**

```typescript
  /**
   * Bulk-load Realtor median_listing_price for a geography type.
   * Only metro, county, zip are supported (state returns 0).
   */
  async preloadRealtorData(geographyType: GeographyType): Promise<number> {
    const route = getRealtorRoute(geographyType);
    if (!route) {
      this.logger.log(`No Realtor data for ${geographyType}, skipping preload`);
      return 0;
    }

    const client = this.supabase.getClient();
    let loaded = 0;
    const pageSize = 1000;
    const geoDateSets = new Map<string, Set<string>>();

    let offset = 0;

    while (true) {
      const { data } = (await client
        .from(route.table)
        .select(`${route.idColumn}, ${route.dateColumn}, median_listing_price`)
        .not('median_listing_price', 'is', null)
        .order(route.idColumn, { ascending: true })
        .order(route.dateColumn, { ascending: true })
        .range(offset, offset + pageSize - 1)) as {
        data: Record<string, any>[] | null;
      };

      if (!data || data.length === 0) break;

      for (const row of data) {
        const geoId = String(row[route.idColumn]);
        const date = String(row[route.dateColumn]);
        const cacheKey = `${geographyType}:${geoId}:${date}`;

        if (!this.realtorCache.has(cacheKey)) {
          this.realtorCache.set(cacheKey, {
            date,
            price: row.median_listing_price as number,
          });
          loaded++;
        }

        const indexKey = `${geographyType}:${geoId}`;
        let dateSet = geoDateSets.get(indexKey);
        if (!dateSet) {
          dateSet = new Set<string>();
          geoDateSets.set(indexKey, dateSet);
        }
        dateSet.add(date);
      }

      if (loaded % 50000 === 0 && loaded > 0) {
        console.log(
          `    ... ${loaded.toLocaleString()} Realtor rows loaded from ${route.table}`,
        );
      }

      if (data.length < pageSize) break;
      offset += pageSize;
    }

    for (const [key, dates] of geoDateSets) {
      this.realtorDateIndex.set(key, [...dates].sort());
    }

    console.log(
      `    Preloaded ${loaded.toLocaleString()} Realtor price points for ${geographyType}`,
    );
    return loaded;
  }
```

**Step 3: Update clearAll() to include Realtor caches**

```typescript
  clearAll(): void {
    this.benchmarkCache.clear();
    this.stateCodeCache.clear();
    this.historicalCache.clear();
    this.historicalDateIndex.clear();
    this.benchmarkDateIndex.clear();
    this.redfinCache.clear();
    this.redfinDateIndex.clear();
    this.realtorCache.clear();
    this.realtorDateIndex.clear();
  }
```

**Step 4: Commit**

```bash
git add packages/backend/src/scoring/backtest/outcome-cache.service.ts
git commit -m "feat(scoring): add Realtor cache and bulk preload method"
```

---

## Task 4: Update Data Source Fallback to Use Caches

**Files:**

- Modify: `packages/backend/src/scoring/backtest/outcome-data-source.service.ts:79-173`

**Context:** `getHistoricalData()` currently checks Zillow cache → Redfin DB query → Realtor DB query. We update it to check Zillow cache → Redfin cache → Realtor cache → DB fallback (rare).

**Step 1: Rewrite getHistoricalData() fallback chain**

Replace the entire `getHistoricalData()` method (lines 79-174) with:

```typescript
  /**
   * Get historical price + rent data with multi-source fallback:
   * Zillow cache (ZHVI + ZORI) → Redfin cache → Realtor cache → DB fallback
   */
  async getHistoricalData(
    geographyId: string,
    geographyType: GeographyType,
    date: string,
  ): Promise<HistoricalDataPoint[] | null> {
    // 1. Try preloaded Zillow cache (includes both ZHVI and ZORI)
    const cached = this.cache.lookupHistorical(
      geographyType,
      geographyId,
      date,
    );
    if (cached !== undefined) return cached;

    // 2. Not in Zillow cache — try Redfin cache
    const redfinCached = this.cache.lookupRedfin(
      geographyType,
      geographyId,
      date,
    );
    if (redfinCached !== undefined) {
      if (redfinCached === null) {
        // Redfin has no data either — try Realtor cache
      } else {
        const result: HistoricalDataPoint[] = [
          { date: redfinCached.date, zhvi: redfinCached.price, source: 'redfin' },
        ];
        this.cache.historicalCache.set(
          `${geographyType}:${geographyId}:${date}`,
          result,
        );
        return result;
      }
    }

    // 3. Try Realtor cache
    const realtorCached = this.cache.lookupRealtor(
      geographyType,
      geographyId,
      date,
    );
    if (realtorCached !== undefined) {
      if (realtorCached !== null) {
        const result: HistoricalDataPoint[] = [
          { date: realtorCached.date, zhvi: realtorCached.price, source: 'realtor' },
        ];
        this.cache.historicalCache.set(
          `${geographyType}:${geographyId}:${date}`,
          result,
        );
        return result;
      }
    }

    // 4. All caches missed — fall back to individual DB queries
    return this.getHistoricalDataFromDb(geographyId, geographyType, date);
  }

  /**
   * DB fallback for historical data (only called when all caches miss).
   */
  private async getHistoricalDataFromDb(
    geographyId: string,
    geographyType: GeographyType,
    date: string,
  ): Promise<HistoricalDataPoint[] | null> {
    const client = this.supabase.getClient();
    const zillowTable = getZillowTable(geographyType);
    const zillowIdCol = getZillowIdColumn(geographyType);

    // Try Zillow ZHVI
    const { data: zillowData } = await client
      .from(zillowTable)
      .select('period_date, value')
      .eq(zillowIdCol, geographyId)
      .eq('metric_name', 'zhvi')
      .lte('period_date', date)
      .order('period_date', { ascending: false })
      .limit(1);

    let result: HistoricalDataPoint[] | null = null;

    if (zillowData?.length) {
      result = [
        {
          date: zillowData[0].period_date,
          zhvi: zillowData[0].value,
          source: 'zillow',
        },
      ];
    }

    // Fallback: Redfin
    if (!result) {
      const redfinRoute = getRedfinRoute(geographyType);
      if (redfinRoute) {
        const { data: redfinData } = (await client
          .from(redfinRoute.table)
          .select('*')
          .eq(redfinRoute.idColumn, geographyId)
          .eq('property_type', 'All Residential')
          .lte(redfinRoute.dateColumn, date)
          .order(redfinRoute.dateColumn, { ascending: false })
          .limit(1)) as { data: Record<string, any>[] | null };

        if (redfinData?.length && redfinData[0].median_sale_price != null) {
          result = [
            {
              date: redfinData[0][redfinRoute.dateColumn],
              zhvi: redfinData[0].median_sale_price,
              source: 'redfin',
            },
          ];
        }
      }
    }

    // Fallback: Realtor
    if (!result) {
      const realtorRoute = getRealtorRoute(geographyType);
      if (realtorRoute) {
        const { data: realtorData } = (await client
          .from(realtorRoute.table)
          .select('*')
          .eq(realtorRoute.idColumn, geographyId)
          .lte(realtorRoute.dateColumn, date)
          .order(realtorRoute.dateColumn, { ascending: false })
          .limit(1)) as { data: Record<string, any>[] | null };

        if (
          realtorData?.length &&
          realtorData[0].median_listing_price != null
        ) {
          result = [
            {
              date: realtorData[0][realtorRoute.dateColumn],
              zhvi: realtorData[0].median_listing_price,
              source: 'realtor',
            },
          ];
        }
      }
    }

    // Cache the result
    const cacheKey = `${geographyType}:${geographyId}:${date}`;
    this.cache.historicalCache.set(cacheKey, result);
    return result;
  }
```

**Step 2: Commit**

```bash
git add packages/backend/src/scoring/backtest/outcome-data-source.service.ts
git commit -m "feat(scoring): update data source fallback to use Redfin/Realtor caches"
```

---

## Task 5: Wire Preloads into populate-outcomes.ts

**Files:**

- Modify: `packages/backend/src/scripts/populate-outcomes.ts:91-111`

**Step 1: Add Redfin and Realtor preload calls**

Replace the preload section (lines 91-111) with:

```typescript
// Bulk-preload caches — one full table scan per geography replaces
// millions of individual per-outcome DB queries.
console.log("  Pre-loading benchmark data (state + national)...");
const bmCount = await cacheService.preloadBenchmarkData();
console.log(`    → ${bmCount} benchmark entries cached`);
for (const geography of geographies) {
  console.log(`  Pre-loading all Zillow ZHVI + ZORI for ${geography}...`);
  const histCount = await cacheService.preloadHistoricalData(geography);
  console.log(
    `    → ${histCount} historical points, ${cacheService.stateCodeCache.size} state codes`,
  );

  console.log(`  Pre-loading Redfin prices for ${geography}...`);
  const redfinCount = await cacheService.preloadRedfinData(geography);
  console.log(`    → ${redfinCount} Redfin price points`);

  console.log(`  Pre-loading Realtor prices for ${geography}...`);
  const realtorCount = await cacheService.preloadRealtorData(geography);
  console.log(`    → ${realtorCount} Realtor price points`);
}
console.log(
  `  Cache sizes: historical=${cacheService.historicalCache.size}, redfin=${cacheService.redfinCache.size}, realtor=${cacheService.realtorCache.size}, benchmark=${cacheService.benchmarkCache.size}, stateCode=${cacheService.stateCodeCache.size}`,
);
// Quick cache-hit diagnostic
const testHit = cacheService.lookupHistorical("metro", "31080", "2021-02-01");
console.log(
  `  Cache test (metro:31080:2021-02-01): ${testHit === undefined ? "MISS (not preloaded)" : testHit === null ? "null (no data)" : `HIT zhvi=${testHit[0]?.zhvi} zori=${testHit[0]?.zori}`}`,
);
console.log("  Pre-loading complete.\n");
```

**Step 2: Commit**

```bash
git add packages/backend/src/scripts/populate-outcomes.ts
git commit -m "feat(scoring): wire Redfin/Realtor/ZORI preloads into outcome population script"
```

---

## Task 6: Add ACS Rent Fallback to Data Source

**Files:**

- Modify: `packages/backend/src/scoring/backtest/outcome-data-source.service.ts`
- Modify: `packages/backend/src/scoring/backtest/outcome-generator.types.ts`

**Context:** When ZORI is missing from the Zillow cache (smaller metros, sparse data), fall back to Census ACS `median_gross_rent`. Census tables use `year` (not `period_date`) and different ID columns.

**Step 1: Add getCensusRoute helper to outcome-generator.types.ts**

After the `getRealtorRoute()` function (line 183), add:

```typescript
export function getCensusRoute(geographyType: string): TableRoute | null {
  switch (geographyType) {
    case "metro":
      return {
        table: "census_metro",
        idColumn: "cbsa_code",
        dateColumn: "year",
      };
    case "county":
      return {
        table: "census_county",
        idColumn: "fips_code",
        dateColumn: "year",
      };
    case "zip":
      return {
        table: "census_zip",
        idColumn: "zcta",
        dateColumn: "year",
      };
    default:
      return null;
  }
}
```

**Step 2: Add ACS rent lookup method to OutcomeDataSourceService**

In `outcome-data-source.service.ts`, add the import for `getCensusRoute`:

```typescript
import {
  getZillowTable,
  getZillowIdColumn,
  getRedfinRoute,
  getRealtorRoute,
  getCensusRoute,
} from "./outcome-generator.types";
```

Then add a new method after `getBenchmarkData()`:

```typescript
  /**
   * Get Census ACS median_gross_rent as fallback when ZORI is unavailable.
   * Census data uses `year` column (not period_date), so we extract the year
   * from the requested date and query for the closest year <= requested.
   */
  async getAcsRentData(
    geographyId: string,
    geographyType: GeographyType,
    date: string,
  ): Promise<number | null> {
    const route = getCensusRoute(geographyType);
    if (!route) return null;

    const requestedYear = parseInt(date.slice(0, 4), 10);
    const client = this.supabase.getClient();

    const { data, error } = await client
      .from(route.table)
      .select(`median_gross_rent, ${route.dateColumn}`)
      .eq(route.idColumn, geographyId)
      .lte(route.dateColumn, requestedYear)
      .not('median_gross_rent', 'is', null)
      .order(route.dateColumn, { ascending: false })
      .limit(1);

    if (error || !data?.length) return null;
    const rent = data[0].median_gross_rent as number;
    // Census uses -666666666 for missing data
    if (rent <= 0) return null;
    return rent;
  }
```

**Step 3: Enrich historical data with ZORI fallback from ACS**

Update `getHistoricalData()` — after getting the initial result from Zillow cache, check if ZORI is missing and fill from ACS. Add this right before the `return cached;` line in the Zillow cache check:

Replace the Zillow cache check block:

```typescript
// 1. Try preloaded Zillow cache (includes both ZHVI and ZORI)
const cached = this.cache.lookupHistorical(geographyType, geographyId, date);
if (cached !== undefined) return cached;
```

With:

```typescript
// 1. Try preloaded Zillow cache (includes both ZHVI and ZORI)
const cached = this.cache.lookupHistorical(geographyType, geographyId, date);
if (cached !== undefined) {
  // Fill missing ZORI from ACS if Zillow cache hit but no rent data
  if (cached && cached[0] && cached[0].zori == null) {
    const acsRent = await this.getAcsRentData(geographyId, geographyType, date);
    if (acsRent != null) {
      cached[0].zori = acsRent;
    }
  }
  return cached;
}
```

**Step 4: Commit**

```bash
git add packages/backend/src/scoring/backtest/outcome-data-source.service.ts packages/backend/src/scoring/backtest/outcome-generator.types.ts
git commit -m "feat(scoring): add Census ACS rent fallback for missing ZORI data"
```

---

## Task 7: Python Isotonic Calibration Training Script

**Files:**

- Create: `scripts/analysis/train_calibration.py`

**Context:** Trains isotonic regression models mapping predicted score percentile → actual return percentile. Exports JSON lookup tables consumed by the TypeScript backend.

**Step 1: Create train_calibration.py**

```python
"""
Train Isotonic Calibration Models for PropertyIQ Scores

Fits sklearn IsotonicRegression per (score_type, geo_level) to map
predicted score percentile → actual excess-return percentile.

Exports calibration lookup tables as JSON for the TypeScript backend.

Usage:
  python train_calibration.py
  python train_calibration.py --geo-level metro
  python train_calibration.py --output-dir ./custom_output
"""

import argparse
import json
import logging
import os
import sys
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.isotonic import IsotonicRegression

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)


def _get_connection_string() -> str:
    """Build PostgreSQL connection string from environment variables."""
    database_url = os.environ.get("DATABASE_URL")
    if database_url:
        return database_url

    project_ref = "pysflbhpnqwoczyuaaif"
    host = "aws-1-us-east-1.pooler.supabase.com"
    port = 6543
    user = f"postgres.{project_ref}"
    password = os.environ.get("SUPABASE_DB_PASSWORD", "")
    if not password:
        logger.error("SUPABASE_DB_PASSWORD not set")
        sys.exit(1)
    return (
        f"postgresql://{user}:{password}"
        f"@{host}:{port}/postgres?sslmode=require"
        f"&options=-c%20statement_timeout%3D300000"
    )


def load_outcomes(conn_string: str, geo_level: str) -> pd.DataFrame:
    """Load backtest outcomes with division mapping for calibration."""
    import sqlalchemy

    engine = sqlalchemy.create_engine(conn_string)

    geo_filter = ""
    if geo_level != "all":
        geo_filter = f"AND bo.geography_type = '{geo_level}'"

    query = f"""
    SELECT
        bo.geography_id,
        bo.geography_type,
        bo.score_type,
        bo.score_date,
        bo.score_value::float,
        bo.state_code,
        bo.outcome_3y_value::float AS outcome_3y,
        bo.excess_vs_state_3y::float,
        bo.rent_return_3y_cagr::float AS rent_return_3y_cagr,
        cdm.division_id,
        cdm.division_name
    FROM propertyiq_backtest_outcomes bo
    LEFT JOIN census_division_mapping cdm
        ON bo.state_code = cdm.state_code
    WHERE bo.score_value IS NOT NULL
      AND bo.outcome_3y_value IS NOT NULL
      {geo_filter}
    ORDER BY bo.score_type, bo.score_date
    """

    df = pd.read_sql(query, engine)
    engine.dispose()
    logger.info("Loaded %d rows for calibration", len(df))
    return df


def compute_excess_returns(df: pd.DataFrame) -> pd.DataFrame:
    """Compute division-relative excess returns (same logic as validate_scores.py)."""
    df = df.copy()
    df["score_date"] = pd.to_datetime(df["score_date"])

    # Appreciation excess vs division median
    group_key = ["score_type", "score_date", "division_id"]
    medians = (
        df.dropna(subset=["outcome_3y", "division_id"])
        .groupby(group_key)["outcome_3y"]
        .transform("median")
    )
    df["excess_div_3y"] = np.nan
    mask = df["outcome_3y"].notna() & df["division_id"].notna()
    df.loc[mask, "excess_div_3y"] = df.loc[mask, "outcome_3y"] - medians.reindex(df.index)

    # Total return (appreciation + rent) for InvestorEdge
    df["total_return_3y"] = np.where(
        df["outcome_3y"].notna() & df["rent_return_3y_cagr"].notna(),
        df["outcome_3y"] + df["rent_return_3y_cagr"],
        np.nan,
    )

    # Total return excess vs division
    tr_medians = (
        df.dropna(subset=["total_return_3y", "division_id"])
        .groupby(group_key)["total_return_3y"]
        .transform("median")
    )
    df["excess_total_div_3y"] = np.nan
    mask = df["total_return_3y"].notna() & df["division_id"].notna()
    df.loc[mask, "excess_total_div_3y"] = (
        df.loc[mask, "total_return_3y"] - tr_medians.reindex(df.index)
    )

    return df


def target_col_for_score(score_type: str) -> str:
    if score_type == "homeready":
        return "excess_div_3y"
    elif score_type == "investoredge":
        return "excess_total_div_3y"
    else:
        raise ValueError(f"Unknown score type: {score_type}")


def train_isotonic(
    scores: np.ndarray,
    excess: np.ndarray,
    n_bins: int = 20,
) -> list[dict]:
    """
    Train isotonic regression mapping predicted percentile → actual percentile.

    1. Bin scores into `n_bins` quantiles
    2. For each bin, compute predicted percentile (midpoint) and actual percentile
    3. Fit IsotonicRegression for smooth monotone mapping
    4. Return lookup table as list of {raw, calibrated} points
    """
    # Compute predicted percentile for each observation
    predicted_pctile = pd.Series(scores).rank(pct=True).values * 100

    # Compute actual excess return percentile
    actual_pctile = pd.Series(excess).rank(pct=True).values * 100

    # Bin into quantiles
    try:
        bin_labels = pd.qcut(predicted_pctile, n_bins, labels=False, duplicates="drop")
    except ValueError:
        bin_labels = (
            pd.Series(predicted_pctile)
            .rank(method="first", pct=True)
            .pipe(lambda x: np.floor(x * n_bins).astype(int).clip(0, n_bins - 1))
            .values
        )

    # Compute bin midpoints and actual percentiles
    bin_predicted = []
    bin_actual = []
    for b in sorted(set(bin_labels)):
        mask = bin_labels == b
        bin_predicted.append(float(np.mean(predicted_pctile[mask])))
        bin_actual.append(float(np.mean(actual_pctile[mask])))

    bin_predicted = np.array(bin_predicted)
    bin_actual = np.array(bin_actual)

    # Fit isotonic regression
    iso = IsotonicRegression(y_min=0, y_max=100, increasing=True)
    iso.fit(bin_predicted, bin_actual)

    # Generate smooth lookup table at regular intervals
    raw_points = np.linspace(0, 100, 101)  # 0, 1, 2, ..., 100
    calibrated_points = iso.predict(raw_points)

    # Return as compact lookup (every 5 points for efficiency)
    table = []
    for i in range(0, 101, 5):
        table.append({
            "raw": round(float(raw_points[i]), 1),
            "calibrated": round(float(calibrated_points[i]), 1),
        })

    return table


def compute_mad(scores: np.ndarray, excess: np.ndarray, calibration_table: list[dict]) -> float:
    """Compute MAD after applying calibration, for validation."""
    raw_lookup = np.array([p["raw"] for p in calibration_table])
    cal_lookup = np.array([p["calibrated"] for p in calibration_table])

    predicted_pctile = pd.Series(scores).rank(pct=True).values * 100
    actual_pctile = pd.Series(excess).rank(pct=True).values * 100

    # Apply calibration via interpolation
    calibrated = np.interp(predicted_pctile, raw_lookup, cal_lookup)

    # Compute MAD by decile
    try:
        decile_labels = pd.qcut(calibrated, 10, labels=False, duplicates="drop") + 1
    except ValueError:
        decile_labels = (
            pd.Series(calibrated)
            .rank(method="first", pct=True)
            .pipe(lambda x: np.ceil(x * 10).astype(int).clip(1, 10))
            .values
        )

    overall_sorted = np.sort(actual_pctile)
    n_total = len(overall_sorted)
    deviations = []

    for d in sorted(set(decile_labels)):
        mask = decile_labels == d
        d_actual = actual_pctile[mask]
        median_actual = float(np.median(d_actual))
        actual_pctile_rank = float(
            np.searchsorted(overall_sorted, median_actual, side="right") / n_total * 100
        )
        predicted_mid = (d - 0.5) / max(decile_labels) * 100
        deviations.append(abs(actual_pctile_rank - predicted_mid))

    return float(np.mean(deviations)) if deviations else 0.0


def main() -> None:
    parser = argparse.ArgumentParser(description="Train isotonic calibration models")
    parser.add_argument("--geo-level", choices=["metro", "county", "all"], default="all")
    parser.add_argument("--output-dir", default=None)
    args = parser.parse_args()

    script_dir = Path(__file__).resolve().parent
    output_dir = Path(args.output_dir) if args.output_dir else script_dir / "output"
    output_dir.mkdir(parents=True, exist_ok=True)

    backend_cal_dir = script_dir.parent.parent / "packages" / "backend" / "src" / "scoring" / "calibration"
    backend_cal_dir.mkdir(parents=True, exist_ok=True)

    conn_string = _get_connection_string()
    geo_levels = ["metro", "county"] if args.geo_level == "all" else [args.geo_level]
    score_types = ["homeready", "investoredge"]

    all_tables: dict[str, list[dict]] = {}

    for geo_level in geo_levels:
        logger.info("=" * 60)
        logger.info("Loading data for %s", geo_level)

        df_raw = load_outcomes(conn_string, geo_level)
        if df_raw.empty:
            logger.warning("No data for %s, skipping", geo_level)
            continue

        df = compute_excess_returns(df_raw)

        for score_type in score_types:
            target = target_col_for_score(score_type)
            df_sub = df[df["score_type"] == score_type].dropna(subset=["score_value", target])

            # Fall back to appreciation excess if total-return target too sparse
            if len(df_sub) < 100 and target != "excess_div_3y":
                logger.warning(
                    "%s/%s: only %d rows with %s, falling back to excess_div_3y",
                    geo_level, score_type, len(df_sub), target,
                )
                target = "excess_div_3y"
                df_sub = df[df["score_type"] == score_type].dropna(
                    subset=["score_value", target]
                )

            if len(df_sub) < 100:
                logger.warning(
                    "%s/%s: insufficient data (%d rows), skipping",
                    geo_level, score_type, len(df_sub),
                )
                continue

            scores = df_sub["score_value"].values
            excess = df_sub[target].values

            logger.info(
                "Training isotonic calibration for %s/%s (n=%d, target=%s)",
                geo_level, score_type, len(scores), target,
            )

            table = train_isotonic(scores, excess)

            # Compute before/after MAD
            before_mad = compute_mad(scores, excess, [
                {"raw": 0, "calibrated": 0}, {"raw": 100, "calibrated": 100}
            ])
            after_mad = compute_mad(scores, excess, table)

            key = f"{score_type}_{geo_level}"
            all_tables[key] = table

            logger.info(
                "  %s: MAD before=%.2f pp, after=%.2f pp (%s)",
                key, before_mad, after_mad,
                "PASS" if after_mad < 15.0 else "FAIL",
            )

    # Write output
    output_path = output_dir / "calibration_tables.json"
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(all_tables, f, indent=2)
    logger.info("Calibration tables written to %s", output_path)

    # Copy to backend
    backend_path = backend_cal_dir / "calibration-tables.json"
    with open(backend_path, "w", encoding="utf-8") as f:
        json.dump(all_tables, f, indent=2)
    logger.info("Calibration tables copied to %s", backend_path)

    logger.info("Done. Train %d calibration models.", len(all_tables))


if __name__ == "__main__":
    main()
```

**Step 2: Commit**

```bash
git add scripts/analysis/train_calibration.py
git commit -m "feat(scoring): add isotonic calibration training script"
```

---

## Task 8: TypeScript Calibration Service

**Files:**

- Create: `packages/backend/src/scoring/calibration/calibration.service.ts`

**Step 1: Create calibration service**

```typescript
/**
 * Calibration Service
 *
 * Applies isotonic calibration to raw percentile scores.
 * Loads a JSON lookup table (trained by scripts/analysis/train_calibration.py)
 * and uses piecewise-linear interpolation to map raw scores to calibrated scores.
 *
 * This compresses the score range to better match actual return percentiles,
 * reducing MAD (Mean Absolute Deviation) below the 15 pp target.
 */

import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import * as fs from "fs";
import * as path from "path";

interface CalibrationPoint {
  raw: number;
  calibrated: number;
}

type CalibrationTables = Record<string, CalibrationPoint[]>;

@Injectable()
export class CalibrationService implements OnModuleInit {
  private readonly logger = new Logger(CalibrationService.name);
  private tables = new Map<string, CalibrationPoint[]>();

  onModuleInit(): void {
    const tablePath = path.join(__dirname, "calibration-tables.json");

    if (!fs.existsSync(tablePath)) {
      this.logger.warn(
        "No calibration-tables.json found — scores will not be calibrated. " +
          "Run scripts/analysis/train_calibration.py to generate.",
      );
      return;
    }

    const raw = fs.readFileSync(tablePath, "utf-8");
    const parsed: CalibrationTables = JSON.parse(raw);

    for (const [key, points] of Object.entries(parsed)) {
      if (Array.isArray(points) && points.length >= 2) {
        this.tables.set(key, points);
      }
    }

    this.logger.log(
      `Loaded calibration tables for: ${[...this.tables.keys()].join(", ")}`,
    );
  }

  /**
   * Apply isotonic calibration to a raw 0-100 score.
   * Returns the calibrated score, or the original score if no table exists.
   */
  calibrate(rawScore: number, scoreType: string, geoLevel: string): number {
    const key = `${scoreType}_${geoLevel}`;
    const table = this.tables.get(key);
    if (!table) return rawScore;

    return this.piecewiseLinearInterpolate(table, rawScore);
  }

  /**
   * Check if calibration is available for a given score type + geo level.
   */
  hasCalibration(scoreType: string, geoLevel: string): boolean {
    return this.tables.has(`${scoreType}_${geoLevel}`);
  }

  /**
   * Piecewise linear interpolation between lookup points.
   * The table is sorted by `raw` (ascending) and monotone by construction.
   */
  private piecewiseLinearInterpolate(
    table: CalibrationPoint[],
    input: number,
  ): number {
    // Clamp to table bounds
    if (input <= table[0].raw) return table[0].calibrated;
    if (input >= table[table.length - 1].raw)
      return table[table.length - 1].calibrated;

    // Find surrounding points
    for (let i = 0; i < table.length - 1; i++) {
      const lo = table[i];
      const hi = table[i + 1];
      if (input >= lo.raw && input <= hi.raw) {
        const t = (input - lo.raw) / (hi.raw - lo.raw);
        return lo.calibrated + t * (hi.calibrated - lo.calibrated);
      }
    }

    // Shouldn't reach here, but fallback
    return input;
  }
}
```

**Step 2: Create placeholder calibration-tables.json**

Create an empty placeholder so the service doesn't warn on first startup:

File: `packages/backend/src/scoring/calibration/calibration-tables.json`

```json
{}
```

**Step 3: Commit**

```bash
git add packages/backend/src/scoring/calibration/calibration.service.ts packages/backend/src/scoring/calibration/calibration-tables.json
git commit -m "feat(scoring): add TypeScript calibration service with piecewise interpolation"
```

---

## Task 9: Integrate Calibration into Scoring Pipeline

**Files:**

- Modify: `packages/backend/src/scoring/scoring.service.ts:92-151`
- Modify: `packages/backend/src/scoring/scoring.module.ts`

**Step 1: Register CalibrationService in ScoringModule**

In `scoring.module.ts`, add the import:

```typescript
import { CalibrationService } from "./calibration/calibration.service";
```

Add `CalibrationService` to the `providers` array (after the core scoring service line):

```typescript
    // Score calibration (isotonic)
    CalibrationService,
```

Add `CalibrationService` to the `exports` array:

```typescript
    CalibrationService,
```

**Step 2: Inject CalibrationService into ScoringService**

In `scoring.service.ts`, add import:

```typescript
import { CalibrationService } from "./calibration/calibration.service";
```

Update the constructor:

```typescript
  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
    private readonly calibrationService: CalibrationService,
    @Optional() private readonly geoChainService?: GeographyChainService,
  ) { }
```

**Step 3: Apply calibration after normalization**

In the `calculateAllScores()` method, after `normalizeScores()` (line 119), apply calibration:

Replace:

```typescript
const normalizedScores = normalizeScores(rawScores);
```

With:

```typescript
const rawNormalized = normalizeScores(rawScores);
const normalizedScores = rawNormalized.map((score) =>
  this.calibrationService.calibrate(score, scoreType, geography),
);
```

**Step 4: Commit**

```bash
git add packages/backend/src/scoring/scoring.service.ts packages/backend/src/scoring/scoring.module.ts
git commit -m "feat(scoring): integrate isotonic calibration into scoring pipeline"
```

---

## Task 10: Update validate_scores.py with Post-Calibration Check

**Files:**

- Modify: `scripts/analysis/validate_scores.py`

**Step 1: Add calibration comparison to validation**

In the `validate_score_type()` function (around line 618-632), after the calibration check, add a section that loads the calibration table and re-checks MAD:

After `calibration = run_calibration_check(df_sub, target)`, add:

```python
    # Post-calibration check (if calibration tables exist)
    calibration_after = None
    cal_tables_path = Path(__file__).resolve().parent / "output" / "calibration_tables.json"
    if cal_tables_path.exists():
        with open(cal_tables_path, "r") as f:
            cal_tables = json.load(f)
        cal_key = f"{score_type}_{df_sub['geography_type'].iloc[0] if 'geography_type' in df_sub.columns else 'metro'}"
        if cal_key in cal_tables:
            table = cal_tables[cal_key]
            raw_lookup = np.array([p["raw"] for p in table])
            cal_lookup = np.array([p["calibrated"] for p in table])

            # Apply calibration to scores
            cal_valid = valid.copy()
            cal_valid["calibrated_score"] = np.interp(
                cal_valid["score_value"].values, raw_lookup, cal_lookup
            )
            calibration_after = run_calibration_check(
                cal_valid.rename(columns={"calibrated_score": "score_value"}),
                target,
            )
            logger.info(
                "  Post-calibration MAD: %.2f pp (was %.2f pp)",
                calibration_after.get("mean_absolute_deviation", 0),
                calibration.get("mean_absolute_deviation", 0),
            )
```

Update the return dict to include the post-calibration result:

```python
    return {
        "score_type": score_type,
        "target_column": target,
        "n_total": len(df_sub),
        "n_with_target": int(df_sub[target].notna().sum()),
        "insample": insample,
        "oos": oos,
        "time_stability": stability,
        "calibration": calibration,
        "calibration_after_isotonic": calibration_after,
    }
```

**Step 2: Add post-calibration section to markdown report**

In `generate_markdown_report()`, after the calibration section (around line 806), add:

```python
        # ---- Post-calibration (if available) ----
        cal_after = st_result.get("calibration_after_isotonic")
        if cal_after and "error" not in cal_after:
            w(f"### 5.4b Post-Isotonic Calibration")
            w()
            w(f"| Decile | Predicted Pctile | Actual Pctile | Deviation | N |")
            w(f"|:------:|-----------------:|--------------:|----------:|----:|")
            for row in cal_after.get("decile_calibration", []):
                w(
                    f"| {row['decile']} "
                    f"| {row['predicted_percentile']:.1f} "
                    f"| {row['actual_percentile']:.1f} "
                    f"| {row['deviation']:.1f} "
                    f"| {row['n']:,} |"
                )
            w()
            mad_after = cal_after.get("mean_absolute_deviation", 0)
            ok_after = cal_after.get("well_calibrated", False)
            mad_before = cal.get("mean_absolute_deviation", 0)
            w(f"**Post-calibration MAD:** {mad_after:.2f} pp (was {mad_before:.2f} pp)")
            w(f"**Well-calibrated (< 15 pp):** {'Yes' if ok_after else 'No'}")
            w()
```

**Step 3: Commit**

```bash
git add scripts/analysis/validate_scores.py
git commit -m "feat(scoring): add post-isotonic calibration check to validation script"
```

---

## Task 11: Verify and Validate

**Step 1: Run TypeScript compilation check**

```bash
cd packages/backend && npx tsc --noEmit 2>&1 | head -30
```

Expected: No errors in modified files.

**Step 2: Run the calibration training script**

```bash
cd scripts/analysis && python train_calibration.py --geo-level metro
```

Expected: Calibration tables generated with before/after MAD values. Target: after MAD < 15 pp.

**Step 3: Run validation**

```bash
cd scripts/analysis && python validate_scores.py --geo-level metro
```

Expected: Post-calibration section appears in report with reduced MAD.

**Step 4: Commit generated calibration tables**

```bash
git add scripts/analysis/output/calibration_tables.json packages/backend/src/scoring/calibration/calibration-tables.json
git commit -m "chore(scoring): add trained calibration lookup tables"
```
