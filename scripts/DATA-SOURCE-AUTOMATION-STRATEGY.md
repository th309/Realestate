# Automated Data Pull Strategy

## Overview

Analysis of all data sources for automated import capabilities, update frequencies, and implementation strategies.

## Data Sources Summary

| Source | Method | Update Frequency | Automation | Difficulty | Priority |
|--------|--------|-----------------|------------|-----------|----------|
| **Census** | API | Annual (ACS5) | ✅ Yes | Easy | High |
| **FRED** | API | Daily/Monthly | ✅ Yes | Easy | High |
| **Zillow** | Manual CSV | Monthly | ⚠️ Partial | Hard | High |
| **Redfin** | Manual CSV | Weekly | ⚠️ Partial | Medium | High |
| **BLS** | API | Monthly | ✅ Yes | Easy | Medium |

---

## 1. Census Bureau (Demographics/Economics/Housing)

### Current Status
- ✅ API available with your key: `ecfbba7f63c684383739d30133554b6e20485fe9`
- Tables: `census_demographics`, `census_economics`, `census_housing`

### Automation Strategy

**API Endpoint:** `https://api.census.gov/data/{year}/acs/acs5`

**Update Schedule:**
- ACS 5-Year: Released annually in December
- ACS 1-Year: Released annually in September
- Decennial Census: Every 10 years (2020, 2030)

**Implementation:**
```typescript
// Pull demographics for all ZIPs annually
const response = await fetch(
  `https://api.census.gov/data/2023/acs/acs5?` +
  `get=B01001_001E,B19013_001E,B15003_022E&` + // Population, Income, Education
  `for=zip%20code%20tabulation%20area:*&` +
  `key=${CENSUS_API_KEY}`
)
```

**Automation Schedule:**
- **When:** January 1st each year (after December release)
- **How:** Scheduled cron job or GitHub Action
- **Data:** Pull for all ~33K ZIPs in one request

**Detection Strategy:**
```typescript
// Check if new year's data is available
async function checkNewCensusData() {
  const currentYear = new Date().getFullYear()
  const latestDataYear = currentYear - 2 // Census has 2-year lag

  const { data } = await supabase
    .from('census_demographics')
    .select('vintage_year')
    .order('vintage_year', { ascending: false })
    .limit(1)

  const ourLatestYear = data[0]?.vintage_year

  if (latestDataYear > ourLatestYear) {
    return { newDataAvailable: true, year: latestDataYear }
  }

  return { newDataAvailable: false }
}
```

**Estimated Time:** ~2 hours (one-time annual pull)

---

## 2. FRED (Federal Reserve Economic Data)

### Current Status
- ✅ API available with your key: `28446a6f75de86ba74668b13912d268c`
- Table: `fred_economic_data` (partitioned by year)

### Automation Strategy

**API Endpoint:** `https://api.stlouisfed.org/fred/series/observations`

**Update Schedule:**
- **Unemployment:** Monthly (1st Friday of month)
- **GDP:** Quarterly (Jan 31, Apr 30, Jul 31, Oct 31)
- **Housing Permits:** Monthly (mid-month)
- **Mortgage Rates:** Weekly (every Thursday)

**Series IDs by Metro:**
- Unemployment: `CBSA{code}UR` (e.g., `CBSA35620UR` for NYC)
- Employment: `SMU{code}0000000001a`
- GDP: State-level only

**Implementation:**
```typescript
// Pull unemployment for a metro
async function pullFREDData(cbsaCode: string, seriesId: string) {
  const response = await fetch(
    `https://api.stlouisfed.org/fred/series/observations?` +
    `series_id=${seriesId}&` +
    `api_key=${FRED_API_KEY}&` +
    `file_type=json`
  )
  return response.json()
}
```

**Automation Schedule:**
- **When:** 1st and 15th of each month
- **How:** Scheduled cron job
- **Data:** Pull for all ~936 metros

**Detection Strategy:**
```typescript
// Check if new FRED data is available
async function checkNewFREDData(seriesId: string) {
  // 1. Get latest date from FRED API
  const fredData = await fetch(
    `https://api.stlouisfed.org/fred/series/observations?` +
    `series_id=${seriesId}&limit=1&sort_order=desc&` +
    `api_key=${FRED_API_KEY}&file_type=json`
  ).then(r => r.json())

  const latestFREDDate = new Date(fredData.observations[0].date)

  // 2. Get latest date from our database
  const { data } = await supabase
    .from('fred_economic_data')
    .select('metric_date')
    .order('metric_date', { ascending: false })
    .limit(1)

  const ourLatestDate = new Date(data[0].metric_date)

  return latestFREDDate > ourLatestDate
}
```

**Estimated Time:** ~30 minutes per metro * 936 = **10 hours** (rate limited)

**Rate Limits:** 120 requests per minute

---

## 3. Zillow (Home Values, Rent, Inventory)

### Current Status
- ⚠️ **NO PUBLIC API** - Manual CSV downloads only
- Table: `zillow_metrics`

### Automation Strategy

**Data Source:** https://www.zillow.com/research/data/

**Update Schedule:**
- ZHVI (Home Values): Monthly (mid-month, ~15th)
- ZORI (Rent Index): Monthly (mid-month)
- Inventory: Monthly

**Problem:** Zillow deprecated their API in 2021. Only CSV downloads available.

**Options:**

**Option A: Manual Download + Auto-Import (RECOMMENDED)**
1. User manually downloads CSVs from Zillow Research
2. Upload to `/data/zillow/` folder
3. Auto-detect new files and import

```typescript
// Watch for new CSV files
import chokidar from 'chokidar'

const watcher = chokidar.watch('data/zillow/*.csv')

watcher.on('add', async (filePath) => {
  console.log(`New Zillow file detected: ${filePath}`)
  await importZillowCSV(filePath)
})
```

**Option B: Web Scraping (NOT RECOMMENDED - Against TOS)**
- Violates Zillow's Terms of Service
- Unstable (page structure changes)
- Could get IP banned

**Option C: Partner API Access (REQUIRES ZILLOW PARTNERSHIP)**
- Apply for Zillow Tech Connect
- Requires proof of business use
- May have fees

**Best Approach:**
```typescript
// Detect when Zillow publishes new data
async function checkZillowDataFreshness() {
  // Check Zillow's data download page for new timestamps
  const response = await fetch('https://www.zillow.com/research/data/')
  const html = await response.text()

  // Parse for "Last Updated: {date}" in HTML
  const match = html.match(/Last Updated:\s*(\w+\s+\d{1,2},\s+\d{4})/)
  const zillowLatestDate = new Date(match[1])

  // Compare with our database
  const { data } = await supabase
    .from('zillow_metrics')
    .select('metric_date')
    .order('metric_date', { ascending: false })
    .limit(1)

  const ourLatestDate = new Date(data[0].metric_date)

  if (zillowLatestDate > ourLatestDate) {
    // Send notification: "New Zillow data available - download required"
    await sendNotification('admin', 'New Zillow data available')
  }
}
```

**Automation Schedule:**
- **When:** Check daily around 15th of month
- **How:** Cron job checks for updates, sends notification
- **Manual Step:** Admin downloads CSVs and drops into watched folder

**Estimated Time:** 5 minutes manual + 30 minutes auto-import

---

## 4. Redfin (Sales Data, Compete Score)

### Current Status
- ⚠️ **NO PUBLIC API** - Manual CSV downloads
- Table: `redfin_metrics` (partitioned by year)

### Automation Strategy

**Data Source:** https://www.redfin.com/news/data-center/

**Update Schedule:**
- Market Tracker: Weekly (every Monday)
- Monthly Metrics: Monthly (1st week)

**Options:**

**Option A: Manual Download + Auto-Import (RECOMMENDED)**
Similar to Zillow approach:

```typescript
// Auto-detect and import Redfin CSVs
async function processRedfinCSV(filePath: string) {
  // Redfin CSVs have different structure than Zillow
  // Need custom parser for their format
  const data = await parseRedfinCSV(filePath)
  await importToDatabase(data)
}
```

**Option B: Redfin Data API (REQUIRES PARTNERSHIP)**
- Contact Redfin Business Development
- May require MLS partnership
- Likely has fees

**Best Approach:**
```typescript
// Monitor Redfin data center for updates
async function checkRedfinDataFreshness() {
  const response = await fetch('https://www.redfin.com/news/data-center/')
  const html = await response.text()

  // Parse for latest data date
  // Redfin shows "Data through: {month} {year}"
  const match = html.match(/Data through:\s*(\w+\s+\d{4})/)
  const redfinLatestDate = new Date(match[1])

  const { data } = await supabase
    .from('redfin_metrics')
    .select('metric_date')
    .order('metric_date', { ascending: false })
    .limit(1)

  const ourLatestDate = new Date(data[0].metric_date)

  if (redfinLatestDate > ourLatestDate) {
    await sendNotification('admin', 'New Redfin data available')
  }
}
```

**Automation Schedule:**
- **When:** Every Monday (weekly check)
- **How:** Cron job monitors for updates
- **Manual Step:** Download and place in watched folder

**Estimated Time:** 5 minutes manual + 45 minutes auto-import

---

## 5. BLS (Bureau of Labor Statistics)

### Current Status
- ✅ API available (registration required - FREE)
- Tables: Can add to `fred_economic_data` or create separate table

### Automation Strategy

**API Endpoint:** `https://api.bls.gov/publicAPI/v2/timeseries/data/`

**Update Schedule:**
- Employment: Monthly (1st Friday)
- Unemployment: Monthly (1st Friday)
- CPI: Monthly (mid-month)

**Implementation:**
```typescript
// Get BLS data
async function pullBLSData(seriesId: string) {
  const response = await fetch(
    'https://api.bls.gov/publicAPI/v2/timeseries/data/',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        seriesid: [seriesId],
        startyear: '2023',
        endyear: '2024',
        registrationkey: BLS_API_KEY
      })
    }
  )
  return response.json()
}
```

**Series IDs:**
- Metro Unemployment: `LAUMT{state}{area}0000000003`
- State Employment: `SMS{state}000000000001`

**Automation Schedule:**
- **When:** 1st Friday of each month
- **How:** Scheduled cron job
- **Data:** ~936 metros

**Rate Limits:** 500 requests/day (free tier)

**Estimated Time:** 2 hours (with rate limiting)

---

## Recommended Implementation Order

### Phase 1: API-Based Sources (Easy Wins)
1. **Census API** - Annual, easy
2. **FRED API** - Monthly, moderate volume
3. **BLS API** - Monthly, register for key

### Phase 2: Manual + Auto-Import (Medium Effort)
4. **Zillow CSV** - Set up file watcher + import
5. **Redfin CSV** - Set up file watcher + import

### Phase 3: Monitoring + Alerting
6. **Freshness Checks** - Daily cron to check for new data
7. **Admin Notifications** - Email/Slack when action needed

---

## Automation Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Data Orchestrator                        │
│                  (Scheduled via Cron/GitHub Actions)         │
└─────────────────────────────────────────────────────────────┘
                            │
           ┌────────────────┼────────────────┐
           │                │                │
      ┌────▼────┐     ┌────▼────┐     ┌────▼────┐
      │ Census  │     │  FRED   │     │   BLS   │
      │   API   │     │   API   │     │   API   │
      │ Importer│     │ Importer│     │ Importer│
      └────┬────┘     └────┬────┘     └────┬────┘
           │                │                │
           └────────────────┼────────────────┘
                            │
                   ┌────────▼────────┐
                   │   Supabase DB   │
                   │  (Upsert Data)  │
                   └────────┬────────┘
                            │
                   ┌────────▼────────┐
                   │  Data Quality   │
                   │    Validator    │
                   └────────┬────────┘
                            │
                   ┌────────▼────────┐
                   │  Notification   │
                   │     System      │
                   └─────────────────┘

Separate Process:

┌─────────────────────────────────────────────────────────────┐
│              CSV File Watcher (Zillow/Redfin)               │
│                                                              │
│  1. Monitor /data/zillow/ and /data/redfin/                 │
│  2. Detect new CSV files                                     │
│  3. Auto-import and validate                                 │
│  4. Notify admin of success/failure                          │
└─────────────────────────────────────────────────────────────┘
```

---

## Next Steps

1. ✅ **Run validation:** `npx tsx scripts/validate-geo-import.ts`
2. 📝 **Create Census importer** (API-based, easiest)
3. 📝 **Create FRED importer** (API-based)
4. 📝 **Create Zillow file watcher** (CSV detection)
5. 📝 **Create Redfin file watcher** (CSV detection)
6. 📝 **Set up cron scheduler** (monthly runs)
7. 📝 **Add monitoring dashboard** (data freshness UI)

---

**Priority Actions:**

1. **Immediate:** Validate current import
2. **This Week:** Build Census + FRED importers
3. **Next Week:** Build Zillow/Redfin file watchers
4. **Month 2:** Add monitoring + alerting

Would you like me to start building these importers?
