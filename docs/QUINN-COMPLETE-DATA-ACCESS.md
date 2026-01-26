# Quinn - Complete Data Access Guide

## ✅ What Quinn Can Access

Quinn now has **complete read access** to all real estate market data plus the user's own personal data:

### 🏠 Real Estate Market Data
- **Zillow** (metro, county, zip, state, city, neighborhood)
- **Realtor.com** (metro, county, zip, state, national)
- **Census** demographics (metro, county, zip, state, city, national)
- **Economic** indicators (metro, county, state, national)
- **PropertyIQ Scores** (current + historical)
- **Calculated Metrics** (GRM, cap rate, ratios, etc.)
- **Geographies** (reference data, inheritance)
- **Market Time Series**
- **HUD Fair Market Rent**
- **Backtest Results** (validation data)
- **TIGER** geographic boundaries
- **News Cache** (market news)

### 👤 User's Personal Data
- **Conversations** (analytics_conversations)
- **Saved Queries** (analytics_saved_queries)
- **Watchlist** (analytics_watchlist)
- **Notes** (analytics_notes)
- **Alerts** (analytics_alerts)

### 🚫 What Quinn CANNOT Access
- ❌ Other users' data
- ❌ Admin/feature flags
- ❌ Beta tester information
- ❌ Authentication/credentials
- ❌ User profiles

---

## 🎯 What You Can Ask Quinn

### Explore Available Data
```
"What tables are available?"
"Show me all the Zillow tables"
"What's in the zillow_metro table?"
"Give me a summary of all data we have"
```

### Query Specific Data
```
"Show me all metros in Texas"
"Get the latest Zillow data for Austin"
"Find all markets with InvestorEdge scores above 80"
"What are the top 10 markets by population?"
```

### Search Across Tables
```
"Search for Austin in all tables"
"Find all data about Phoenix"
"Show me everywhere Denver is mentioned"
```

### Aggregate & Analyze
```
"What's the average InvestorEdge score by state?"
"Count how many metros are in each state"
"What's the total population across all metros?"
"Show me the min and max home prices by state"
```

### User's Personal Data
```
"Show me my saved queries"
"What markets are in my watchlist?"
"Show me my recent conversations"
"What alerts do I have set up?"
```

### Combined Queries
```
"Get Zillow and Realtor data for all Texas metros with scores above 75"
"Show me Census demographics for my watchlist markets"
"Compare the metrics I saved in my query to current data"
```

---

## 🛠️ New Tools Available

### 1. `get_database_tables`
Lists all accessible tables with row counts and column info.

**Example:**
```
"What tables can I query?"
```

**Returns:**
```json
{
  "total_tables": 35,
  "tables": {
    "zillow_metro": {
      "row_count": 125000,
      "columns": ["region_id", "region_name", "period_date", "metric_name", "value"],
      "column_count": 5
    },
    ...
  }
}
```

---

### 2. `describe_database_table`
Get detailed schema for a specific table.

**Example:**
```
"Describe the propertyiq_scores table"
```

**Returns:**
```json
{
  "table_name": "propertyiq_scores",
  "row_count": 15000,
  "columns": [
    {
      "name": "geography_id",
      "type": "object",
      "unique_count": 15000,
      "sample_values": ["12420", "26420", "31080"]
    },
    {
      "name": "investoredge_score",
      "type": "float64",
      "min": 0.0,
      "max": 100.0,
      "mean": 52.3,
      "sample_values": [78.5, 65.2, 45.8]
    }
  ]
}
```

---

### 3. `query_database_table`
Query any table with filters, sorting, pagination.

**Example Queries:**

**Simple filter:**
```
"Get all metros in Texas from the geographies table"

Tool call:
{
  "table_name": "geographies",
  "filters": {
    "geography_type": "metro",
    "parent_geography_id": "TX"
  }
}
```

**Range filter:**
```
"Find markets with InvestorEdge scores between 70 and 90"

Tool call:
{
  "table_name": "propertyiq_scores",
  "filters": {
    "investoredge_score": {"gte": 70, "lte": 90}
  },
  "order_by": "-investoredge_score",
  "limit": 50
}
```

**Pattern matching:**
```
"Find all metros with 'Austin' in the name"

Tool call:
{
  "table_name": "geographies",
  "filters": {
    "geography_name": {"like": "%Austin%"}
  }
}
```

**Multiple filters:**
```
"Get latest Zillow data for Texas metros, sorted by date"

Tool call:
{
  "table_name": "zillow_metro",
  "filters": {
    "state_code": "TX",
    "metric_name": "ZHVI"
  },
  "order_by": "-period_date",
  "limit": 100
}
```

---

### 4. `search_database`
Search for a term across multiple tables.

**Example:**
```
"Search for Phoenix across all tables"

Tool call:
{
  "search_term": "Phoenix",
  "limit_per_table": 10
}
```

**Returns:** Matching rows from each table that contains "Phoenix"

---

### 5. `aggregate_database`
Run aggregations (COUNT, SUM, AVG, MIN, MAX).

**Example Queries:**

**Count by group:**
```
"How many metros are in each state?"

Tool call:
{
  "table_name": "propertyiq_scores",
  "aggregations": [
    {"function": "count", "column": "geography_id", "alias": "metro_count"}
  ],
  "group_by": ["parent_geography_id"],
  "filters": {"geography_type": "metro"}
}
```

**Average score:**
```
"What's the average InvestorEdge score by state?"

Tool call:
{
  "table_name": "propertyiq_scores",
  "aggregations": [
    {"function": "avg", "column": "investoredge_score", "alias": "avg_score"}
  ],
  "group_by": ["parent_geography_id"]
}
```

**Multiple aggregations:**
```
"Show me min, max, and average scores for each state"

Tool call:
{
  "table_name": "propertyiq_scores",
  "aggregations": [
    {"function": "min", "column": "investoredge_score", "alias": "min_score"},
    {"function": "max", "column": "investoredge_score", "alias": "max_score"},
    {"function": "avg", "column": "investoredge_score", "alias": "avg_score"}
  ],
  "group_by": ["parent_geography_id"]
}
```

---

### 6. `get_database_summary`
High-level summary of all data.

**Example:**
```
"What data is available?"
```

**Returns:**
```json
{
  "zillow": {
    "metro": {"records": 125000, "latest_date": "2026-01-01"},
    "county": {"records": 350000, "latest_date": "2026-01-01"},
    "zip": {"records": 1200000, "latest_date": "2026-01-01"}
  },
  "realtor": {
    "metro": {"records": 110000, "latest_date": "2025-12-01"}
  },
  "scores": {
    "current": {"records": 15000},
    "history": {"records": 450000}
  },
  "analytics": {
    "conversations": {"records": 523},
    "saved_queries": {"records": 87},
    "watchlist": {"records": 234}
  }
}
```

---

## 🔒 Security & Privacy

### Access Controls
- ✅ Real estate data: **Read-only** access
- ✅ User's own data: **Read-only** access
- ❌ Other users' data: **Blocked**
- ❌ Admin tables: **Blocked**
- ❌ Credentials/auth: **Blocked**

### Implementation
- **Whitelist-based:** Only approved tables accessible
- **Application-layer filtering:** User-specific data filtered by user_id
- **No write access:** Quinn can only read data, never modify
- **Audit logging:** All queries logged for security

---

## 💡 Example Conversations

### Example 1: Market Research
**User:** "I want to analyze Austin's market"

**Quinn:**
1. *Searches for Austin*
2. "I found Austin-Round Rock-Georgetown, TX Metro (CBSA: 12420)"
3. *Queries propertyiq_scores for 12420*
4. "Austin has an InvestorEdge score of 78.5 (top quintile)"
5. *Queries zillow_metro for 12420*
6. "Latest ZHVI: $485,000, up 12.3% YoY"
7. *Queries realtor_metro*
8. "Median listing price: $525,000, 45 days on market"

### Example 2: Saved Queries
**User:** "Show me my saved queries"

**Quinn:** *Queries analytics_saved_queries filtered by user_id*
```
You have 5 saved queries:
1. "Texas High-Growth Metros" - Saved Jan 15
2. "Affordable Midwest Markets" - Saved Jan 10
3. "Best Cash Flow Markets" - Saved Jan 8
4. "Sunbelt Population Growth" - Saved Jan 5
5. "California vs Texas Comparison" - Saved Dec 28
```

### Example 3: Watchlist Analysis
**User:** "Run InvestorEdge analysis on my watchlist"

**Quinn:**
1. *Queries analytics_watchlist for user*
2. "You're watching 12 markets"
3. *Queries propertyiq_scores for those markets*
4. "Average InvestorEdge: 72.3"
5. "Top 3: Boise (85.2), Austin (78.5), Raleigh (76.8)"
6. *Queries zillow_metro for appreciation*
7. "Average 3-year appreciation: 28.4%"

### Example 4: Cross-Source Analysis
**User:** "Compare Zillow and Realtor data for Phoenix"

**Quinn:**
1. *Searches for Phoenix, finds CBSA 38060*
2. *Queries zillow_metro*
   - "Zillow ZHVI: $435,000"
3. *Queries realtor_metro*
   - "Realtor median listing: $450,000"
   - "Difference: $15,000 (3.4%)"
4. *Queries census_metro*
   - "Population: 4.9M, growing 2.1%/year"

---

## 🚀 Getting Started

### 1. Start Services
```bash
# Terminal 1 - Python Analytics
cd packages/propertyiq-analytics
uvicorn app.main:app --reload

# Terminal 2 - Backend
cd packages/backend
npm run start:dev

# Terminal 3 - Frontend
cd packages/frontend
npm run dev
```

### 2. Open Quinn

Navigate to your app and click the Quinn button.

### 3. Try These Queries

**Explore:**
```
"What tables are available?"
"Show me the structure of zillow_metro"
"Give me a data summary"
```

**Query:**
```
"Get all metros in California"
"Find markets with scores above 75"
"Show me my watchlist"
```

**Analyze:**
```
"What's the average score by state?"
"Count metros per state"
"Compare Zillow vs Realtor prices for Austin"
```

---

## 📋 Files Created/Modified

### New Files
1. `packages/propertyiq-analytics/app/services/database_query_service.py` - Database query service with whitelist
2. `packages/propertyiq-analytics/app/api/routes/database.py` - API endpoints for database queries
3. `docs/QUINN-COMPLETE-DATA-ACCESS.md` - This guide

### Modified Files
1. `packages/propertyiq-analytics/app/main.py` - Added database router
2. `packages/backend/src/analytics-chat/analytics-tools.service.ts` - Added 6 new database tools

---

## 🎉 Summary

Quinn can now answer **ANY question** about your real estate data:

✅ **Direct database access** to all market data tables
✅ **35+ tables** accessible (Zillow, Realtor, Census, Economic, Scores)
✅ **User's personal data** (saved queries, watchlist, alerts, conversations)
✅ **Flexible querying** (filters, sorting, pagination, aggregations)
✅ **Cross-table search** to find data anywhere
✅ **Privacy protected** (only user's own data + public market data)

Ask Quinn anything about your real estate data - it has complete visibility! 🚀
