import { EndpointSection } from "./EndpointSection";

/**
 * All 12 endpoint documentation blocks for the API reference.
 * Extracted from page.tsx to keep files under the 400-line limit.
 */
export function EndpointsReference() {
  return (
    <div className="space-y-6">
      {/* Health */}
      <EndpointSection
        id="endpoint-health"
        method="GET"
        path="/api/v1/health"
        description="Verify your API key is working. Returns your organization name, active scopes, rate limit, and key expiration. This endpoint does not count against your rate limit — use it freely for debugging."
        scope="(any valid key)"
        curlExample={`curl -H "Authorization: Bearer YOUR_API_KEY" \\
  https://backend-production-ee4d.up.railway.app/api/v1/health`}
        responseExample={`{
  "data": {
    "status": "ok",
    "organization": "Acme Realty Group",
    "scopes": ["scores:read", "metrics:read"],
    "rate_limit_rpm": 120,
    "expires_at": null
  },
  "meta": {
    "request_id": "req_7f3a2b1c",
    "timestamp": "2026-03-26T12:00:00Z"
  }
}`}
      />

      {/* Scores */}
      <EndpointSection
        id="endpoint-scores"
        method="GET"
        path="/api/v1/scores/:geoLevel/:geoId"
        description="Retrieve the PropertyIQ Score for a single geography."
        scope="scores:read"
        queryParams={[
          {
            name: "geoLevel",
            type: "string",
            required: true,
            description: "state, metro, county, or zip",
          },
          {
            name: "geoId",
            type: "string",
            required: true,
            description: "Region identifier (FIPS, CBSA, or ZIP code)",
          },
        ]}
        curlExample={`curl "https://api.propertyiq.app/api/v1/scores/metro/31080" \\
  -H "Authorization: Bearer piq_live_abc123..."`}
        responseExample={`{
  "data": {
    "propertyiq": { "score": 78, "confidence": "A", "updated_at": "2026-03-20" }
  }
}`}
      />

      <EndpointSection
        method="GET"
        path="/api/v1/scores/:geoLevel/:geoId/:scoreType"
        description="Retrieve a single score type with full component breakdown and confidence details."
        scope="scores:read"
        queryParams={[
          {
            name: "scoreType",
            type: "string",
            required: true,
            description: "propertyiq (the only score)",
          },
        ]}
        curlExample={`curl "https://api.propertyiq.app/api/v1/scores/metro/31080/propertyiq" \\
  -H "Authorization: Bearer piq_live_abc123..."`}
        responseExample={`{
  "data": {
    "score": 82,
    "label": "STRONG",
    "confidence": { "level": "A", "percentage": 91, "metrics_available": 11, "metrics_total": 12 },
    "components": {
      "affordability": 78,
      "appreciation": 85,
      "market_stability": 83
    }
  }
}`}
      />

      {/* Metrics */}
      <EndpointSection
        id="endpoint-metrics"
        method="GET"
        path="/api/v1/metrics/:metricId/:geoLevel"
        description="Get current values for a metric across all regions at the specified geography level. Results are paginated."
        scope="metrics:read"
        queryParams={[
          {
            name: "limit",
            type: "number",
            description: "Results per page (default 50, max 200)",
          },
          {
            name: "cursor",
            type: "string",
            description: "Pagination cursor from previous response",
          },
          {
            name: "sort",
            type: "string",
            description: "Sort order: asc or desc (default desc)",
          },
        ]}
        curlExample={`curl "https://api.propertyiq.app/api/v1/metrics/home_value/metro?limit=5" \\
  -H "Authorization: Bearer piq_live_abc123..."`}
        responseExample={`{
  "data": [
    { "region_id": "31080", "region_name": "Los Angeles-Long Beach-Anaheim, CA", "value": 892450, "period_date": "2026-02-28" },
    { "region_id": "35620", "region_name": "New York-Newark-Jersey City, NY-NJ-PA", "value": 621300, "period_date": "2026-02-28" }
  ],
  "meta": { "pagination": { "total": 925, "limit": 5, "next_cursor": "eyJpZCI6NX0" } }
}`}
      />

      <EndpointSection
        method="GET"
        path="/api/v1/metrics/:metricId/:geoLevel/:geoId"
        description="Get the current value of a single metric for one region."
        scope="metrics:read"
        curlExample={`curl "https://api.propertyiq.app/api/v1/metrics/home_value/metro/31080" \\
  -H "Authorization: Bearer piq_live_abc123..."`}
        responseExample={`{
  "data": {
    "region_id": "31080",
    "region_name": "Los Angeles-Long Beach-Anaheim, CA",
    "value": 892450,
    "period_date": "2026-02-28",
    "source": "ZHVI"
  }
}`}
      />

      {/* Time Series */}
      <EndpointSection
        id="endpoint-timeseries"
        method="GET"
        path="/api/v1/timeseries/:metricId/:geoLevel/:geoId"
        description="Get historical time series data for a metric in a specific region."
        scope="metrics:read"
        queryParams={[
          {
            name: "start_date",
            type: "string",
            description:
              "ISO date — beginning of range (default 12 months ago)",
          },
          {
            name: "end_date",
            type: "string",
            description: "ISO date — end of range (default today)",
          },
          {
            name: "interval",
            type: "string",
            description: "monthly or quarterly (default monthly)",
          },
        ]}
        curlExample={`curl "https://api.propertyiq.app/api/v1/timeseries/home_value/metro/31080?start_date=2025-01-01" \\
  -H "Authorization: Bearer piq_live_abc123..."`}
        responseExample={`{
  "data": [
    { "period_date": "2025-01-31", "value": 845200 },
    { "period_date": "2025-02-28", "value": 851300 },
    { "period_date": "2025-03-31", "value": 858900 }
  ]
}`}
      />

      {/* Rankings */}
      <EndpointSection
        id="endpoint-rankings"
        method="GET"
        path="/api/v1/rankings/:scoreType/:geoLevel"
        description="Get ranked market leaderboards by score type. Returns the top markets ordered by score."
        scope="rankings:read"
        queryParams={[
          {
            name: "limit",
            type: "number",
            description: "Number of results (default 25, max 100)",
          },
          {
            name: "offset",
            type: "number",
            description: "Offset for pagination (default 0)",
          },
        ]}
        curlExample={`curl "https://api.propertyiq.app/api/v1/rankings/propertyiq/metro?limit=3" \\
  -H "Authorization: Bearer piq_live_abc123..."`}
        responseExample={`{
  "data": [
    { "rank": 1, "region_id": "41740", "region_name": "San Diego-Chula Vista-Carlsbad, CA", "score": 91 },
    { "rank": 2, "region_id": "12060", "region_name": "Atlanta-Sandy Springs-Alpharetta, GA", "score": 89 },
    { "rank": 3, "region_id": "19740", "region_name": "Denver-Aurora-Lakewood, CO", "score": 87 }
  ]
}`}
      />

      {/* Reports */}
      <EndpointSection
        id="endpoint-reports"
        method="POST"
        path="/api/v1/reports"
        description="Trigger generation of a new market report. Report generation is asynchronous — poll the returned ID for status."
        scope="reports:write"
        bodyParams={[
          {
            name: "geo_level",
            type: "string",
            required: true,
            description: "state, metro, county, or zip",
          },
          {
            name: "geo_id",
            type: "string",
            required: true,
            description: "Region identifier",
          },
          {
            name: "report_type",
            type: "string",
            required: true,
            description: "full, summary, or investment",
          },
        ]}
        curlExample={`curl -X POST "https://api.propertyiq.app/api/v1/reports" \\
  -H "Authorization: Bearer piq_live_abc123..." \\
  -H "Content-Type: application/json" \\
  -d '{ "geo_level": "metro", "geo_id": "31080", "report_type": "full" }'`}
        responseExample={`{
  "data": {
    "id": "rpt_7f3a9c2e",
    "status": "generating",
    "created_at": "2026-03-24T12:00:00Z"
  }
}`}
      />

      <EndpointSection
        method="GET"
        path="/api/v1/reports/:id"
        description="Get a report by ID. If still generating, status will be 'generating'. Poll until 'complete'."
        scope="reports:read"
        curlExample={`curl "https://api.propertyiq.app/api/v1/reports/rpt_7f3a9c2e" \\
  -H "Authorization: Bearer piq_live_abc123..."`}
        responseExample={`{
  "data": {
    "id": "rpt_7f3a9c2e",
    "status": "complete",
    "geo_level": "metro",
    "geo_id": "31080",
    "report_type": "full",
    "content": { "summary": "...", "sections": [ ... ] },
    "created_at": "2026-03-24T12:00:00Z"
  }
}`}
      />

      <EndpointSection
        method="GET"
        path="/api/v1/reports"
        description="List all reports for your organization, ordered by creation date descending."
        scope="reports:read"
        queryParams={[
          {
            name: "limit",
            type: "number",
            description: "Results per page (default 20, max 100)",
          },
          { name: "cursor", type: "string", description: "Pagination cursor" },
          {
            name: "status",
            type: "string",
            description: "Filter by status: generating, complete, or failed",
          },
        ]}
        curlExample={`curl "https://api.propertyiq.app/api/v1/reports?limit=5&status=complete" \\
  -H "Authorization: Bearer piq_live_abc123..."`}
        responseExample={`{
  "data": [
    { "id": "rpt_7f3a9c2e", "status": "complete", "geo_level": "metro", "geo_id": "31080", "report_type": "full", "created_at": "2026-03-24T12:00:00Z" }
  ],
  "meta": { "pagination": { "total": 12, "limit": 5, "next_cursor": "eyJpZCI6NX0" } }
}`}
      />

      {/* Watchlist */}
      <EndpointSection
        id="endpoint-watchlist"
        method="GET"
        path="/api/v1/watchlist"
        description="List all markets on your organization's watchlist."
        scope="watchlist:read"
        curlExample={`curl "https://api.propertyiq.app/api/v1/watchlist" \\
  -H "Authorization: Bearer piq_live_abc123..."`}
        responseExample={`{
  "data": [
    { "id": "wl_a1b2c3", "geo_level": "metro", "geo_id": "31080", "region_name": "Los Angeles-Long Beach-Anaheim, CA", "added_at": "2026-03-10T09:00:00Z" }
  ]
}`}
      />

      <EndpointSection
        method="POST"
        path="/api/v1/watchlist"
        description="Add a market to your organization's watchlist."
        scope="watchlist:write"
        bodyParams={[
          {
            name: "geo_level",
            type: "string",
            required: true,
            description: "state, metro, county, or zip",
          },
          {
            name: "geo_id",
            type: "string",
            required: true,
            description: "Region identifier",
          },
        ]}
        curlExample={`curl -X POST "https://api.propertyiq.app/api/v1/watchlist" \\
  -H "Authorization: Bearer piq_live_abc123..." \\
  -H "Content-Type: application/json" \\
  -d '{ "geo_level": "metro", "geo_id": "31080" }'`}
        responseExample={`{
  "data": {
    "id": "wl_d4e5f6",
    "geo_level": "metro",
    "geo_id": "31080",
    "region_name": "Los Angeles-Long Beach-Anaheim, CA",
    "added_at": "2026-03-24T12:05:00Z"
  }
}`}
      />

      <EndpointSection
        method="DELETE"
        path="/api/v1/watchlist/:id"
        description="Remove a market from your organization's watchlist."
        scope="watchlist:write"
        curlExample={`curl -X DELETE "https://api.propertyiq.app/api/v1/watchlist/wl_d4e5f6" \\
  -H "Authorization: Bearer piq_live_abc123..."`}
        responseExample={`{
  "data": { "deleted": true }
}`}
      />
    </div>
  );
}
