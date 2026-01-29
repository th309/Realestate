# Cap Rate & Calculated Metrics – What Was Done and What You Have

## The Problem You Described

- Cap rate maps were **bare** even though there’s lots of ZORI data (metro, zip, city, county).
- Cap rate is a **calculated metric**: it’s not stored in ZORI tables; it’s (Monthly Rent × 12 × 0.60) / Home Value × 100 and belongs in the **`calculated_metrics`** table.
- So the map is only as good as what’s in `calculated_metrics`. If that table is empty or sparse for cap rate, the map stays bare.

---

## What Was Changed (and Where)

### 1. Backend: Metro cap rate batch fix

**File:** `packages/backend/src/metrics/calculated-metrics.service.ts`

- When the **NestJS** batch runs (e.g. `POST /api/metrics/calculate-investment-metrics`), it fills `calculated_metrics` from ZORI + ZHVI (or Realtor price) by geography.
- For **metros**, if ZORI and ZHVI didn’t share the same date, the code tried a “fallback” (use latest ZHVI on or before the ZORI date) but **never used that fallback** to build the price lookup. So metro cap rate rows often weren’t written.
- **Fix:** The fallback result is now used to build the price lookup, so metros get written even when ZORI and ZHVI dates don’t match exactly.

**You have:** Metro cap rate from the **backend** batch should no longer be “lost” due to date mismatch.

---

### 2. Script: Populate calculated metrics – now “full history”

**File:** `scripts/populate-calculated-metrics.ts`

- This script is what the **GitHub workflow** (and you, locally) runs to fill `calculated_metrics`. It uses **ZORI** (and HUD FMR / Census as fallbacks) for rent and **Realtor** for price.
- **Before:** It only wrote **one row per geography** (latest rent + latest price).
- **After:** It was changed to write **historical** rows:
  - It collects **period_dates** that have ZORI.
  - For **each** such date, it fetches ZORI and Realtor price for that date, computes cap rate (and related metrics), and upserts into `calculated_metrics` with that `period_date`.
  - Then a **fill-in** pass adds one row per geography for HUD/Census-only geos at the latest Realtor date (so those geos still get a cap rate even without ZORI).

**You have:** A script that is *intended* to backfill **all** months that have both ZORI and Realtor price, plus a latest-date row for HUD/Census-only geos.

**Catch:** Right now “all period_dates” is built from a **single paginated** query (first 5000 ZORI rows). So you only get as many distinct dates as appear in that first slice. For your DB that turned out to be **5 metro dates, 3 county, 0 zip** – so you’re not yet getting true “full” history, just a few months. Fixing that would require collecting distinct dates from the full ZORI set (e.g. dedicated query or full scan).

---

### 3. Script: “Ensure calculated metrics populated”

**File:** `scripts/ensure-calculated-metrics-populated.ts`

- **What it does:**
  1. **Check:** Reads from the DB – ZORI/ZHVI row counts and latest dates in `zillow_metro`, `zillow_county`, `zillow_zip`, and cap_rate counts in `calculated_metrics`.
  2. **Import (optional):** If ZORI or ZHVI is missing, runs the Zillow import (`scripts/zillow-import/import-all.ts` for Metro, County, Zip, zori+zhvi).
  3. **Populate:** Runs `scripts/populate-calculated-metrics.ts`.

- **Usage:**
  - `npx tsx scripts/ensure-calculated-metrics-populated.ts`  
    → check, import if needed, then populate.
  - `npx tsx scripts/ensure-calculated-metrics-populated.ts --check-only`  
    → only check DB; no import or populate.
  - `npx tsx scripts/ensure-calculated-metrics-populated.ts --skip-import`  
    → skip Zillow import; run populate only.

**You have:** A single entry point to “make sure data is there and then run the full populate.”

---

### 4. Doc: Why the map was bare

**File:** `docs/CAP-RATE-MAP-DEEP-DIVE.md`

- Describes: where cap rate comes from (calculated metric, not raw ZORI), how the map gets it (API → `calculated_metrics`), why maps were bare (empty/sparse `calculated_metrics`, metro fallback bug), and that the fix is to run the batch and optionally fix/remove the metro fallback.

**You have:** A written deep dive for future reference.

---

## What You Actually Have Right Now (after the last run)

- **calculated_metrics** has cap rate (and related) rows:
  - From the **historical** logic: only a few dates (5 metro, 3 county, 0 zip) because distinct dates are still limited by the first 5000 ZORI rows.
  - From the **fill-in**: 57 metro, 753 county, 104 zip at latest date (HUD/Census + Realtor).
- The run also hit:
  - A **statement timeout** during one of the upserts (some rows may not have been written).
  - Some **overvalued** errors (null `geography_id`, conflict); that’s a different part of the same script.
- **Total** cap_rate rows in DB (from the script’s verification): **43,764** (that includes whatever was there before plus what this run added).

So: **you have a lot of cap rate rows in `calculated_metrics`**, but the **“historical” part of the script is still limited** to a small number of months until we fix how distinct ZORI dates are collected.

---

## What’s Still Missing or Broken

1. **Full history:** The script does not yet see *all* ZORI months; it only uses dates from the first 5000 ZORI rows. To get real full history, the script needs to gather **all** distinct `period_date` values from ZORI (e.g. raw SQL or paginated full scan), then loop over those dates as it does now.
2. **Map still bare in some places:** If the map is still bare for certain geos or zoom levels, it’s usually because:
   - The **map API** returns data keyed by CBSA (metro), FIPS (county), or ZIP; `calculated_metrics` uses `geography_id` for that. If IDs don’t match (e.g. format or missing rows), the map won’t paint.
   - Or there are simply no rows in `calculated_metrics` for that geography/date (e.g. no Realtor price for that geo, or timeout skipped that batch).
3. **Overvalued errors:** The overvalued-percentage step in the same script has its own bugs (null `geography_id`, duplicate key); those don’t affect cap rate but do affect that metric.

---

## One-sentence summary

**You have:** a backend fix so metro cap rate isn’t dropped when dates don’t match, a populate script that’s *designed* for full history (but currently only gets a few months of dates), a small “ensure populated” script that can check DB + import Zillow + run populate, and a doc explaining why the map was bare; **you do not yet have** true full-history backfill (all ZORI months) until we fix how distinct dates are collected in the populate script.
