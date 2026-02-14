/**
 * API Endpoints Integration Test Suite
 *
 * Tests PropertyIQ backend API endpoints for:
 * - 200 status responses
 * - Valid JSON responses
 * - Expected response shape (non-empty)
 * - Response time under 3 seconds
 */

const API_URL = process.env.API_URL || 'http://localhost:3001';
const TIMEOUT_MS = 10000;
const MAX_RESPONSE_TIME_MS = 3000;

interface TestEndpoint {
  method: 'GET' | 'POST';
  path: string;
  description?: string;
}

async function testEndpoint(endpoint: TestEndpoint): Promise<{
  status: number;
  data: unknown;
  responseTime: number;
}> {
  const startTime = Date.now();
  const response = await fetch(`${API_URL}${endpoint.path}`, {
    method: endpoint.method,
    headers: {
      'Content-Type': 'application/json',
    },
  });
  const responseTime = Date.now() - startTime;
  const data = await response.json();

  return {
    status: response.status,
    data,
    responseTime,
  };
}

function isNonEmptyResponse(data: unknown): boolean {
  if (data === null || data === undefined) {
    return false;
  }
  if (Array.isArray(data)) {
    return true; // Empty arrays are valid responses
  }
  if (typeof data === 'object') {
    return Object.keys(data as object).length > 0;
  }
  return true;
}

// =============================================================================
// Health Endpoints (7 endpoints)
// =============================================================================

const healthEndpoints: TestEndpoint[] = [
  { method: 'GET', path: '/api/health', description: 'Main health check' },
  { method: 'GET', path: '/api/health/data-cards', description: 'Data cards health' },
  { method: 'GET', path: '/api/health/database', description: 'Database health' },
  { method: 'GET', path: '/api/health/cache', description: 'Cache health' },
  { method: 'GET', path: '/api/health/external', description: 'External services health' },
  { method: 'GET', path: '/api/health/ready', description: 'Readiness check' },
  { method: 'GET', path: '/api/health/live', description: 'Liveness check' },
];

// =============================================================================
// Metrics Endpoints (10 key endpoints)
// =============================================================================

const metricsEndpoints: TestEndpoint[] = [
  { method: 'GET', path: '/api/metrics', description: 'Main metrics' },
  { method: 'GET', path: '/api/metrics/overview', description: 'Metrics overview' },
  { method: 'GET', path: '/api/metrics/performance', description: 'Performance metrics' },
  { method: 'GET', path: '/api/metrics/cache', description: 'Cache metrics' },
  { method: 'GET', path: '/api/metrics/database', description: 'Database metrics' },
  { method: 'GET', path: '/api/metrics/requests', description: 'Request metrics' },
  { method: 'GET', path: '/api/metrics/errors', description: 'Error metrics' },
  { method: 'GET', path: '/api/metrics/latency', description: 'Latency metrics' },
  { method: 'GET', path: '/api/metrics/throughput', description: 'Throughput metrics' },
  { method: 'GET', path: '/api/metrics/resources', description: 'Resource metrics' },
];

// =============================================================================
// Scores Endpoints (18 endpoints)
// =============================================================================

const scoresEndpoints: TestEndpoint[] = [
  { method: 'GET', path: '/api/scores', description: 'Main scores' },
  { method: 'GET', path: '/api/scores/overall', description: 'Overall score' },
  { method: 'GET', path: '/api/scores/location', description: 'Location score' },
  { method: 'GET', path: '/api/scores/market', description: 'Market score' },
  { method: 'GET', path: '/api/scores/property', description: 'Property score' },
  { method: 'GET', path: '/api/scores/investment', description: 'Investment score' },
  { method: 'GET', path: '/api/scores/risk', description: 'Risk score' },
  { method: 'GET', path: '/api/scores/growth', description: 'Growth score' },
  { method: 'GET', path: '/api/scores/rental', description: 'Rental score' },
  { method: 'GET', path: '/api/scores/appreciation', description: 'Appreciation score' },
  { method: 'GET', path: '/api/scores/cashflow', description: 'Cashflow score' },
  { method: 'GET', path: '/api/scores/affordability', description: 'Affordability score' },
  { method: 'GET', path: '/api/scores/demand', description: 'Demand score' },
  { method: 'GET', path: '/api/scores/supply', description: 'Supply score' },
  { method: 'GET', path: '/api/scores/neighborhood', description: 'Neighborhood score' },
  { method: 'GET', path: '/api/scores/school', description: 'School score' },
  { method: 'GET', path: '/api/scores/crime', description: 'Crime score' },
  { method: 'GET', path: '/api/scores/walkability', description: 'Walkability score' },
];

// =============================================================================
// Geography Endpoints (10 endpoints)
// =============================================================================

const geographyEndpoints: TestEndpoint[] = [
  { method: 'GET', path: '/api/geography', description: 'Main geography' },
  { method: 'GET', path: '/api/geography/states', description: 'States list' },
  { method: 'GET', path: '/api/geography/counties', description: 'Counties list' },
  { method: 'GET', path: '/api/geography/cities', description: 'Cities list' },
  { method: 'GET', path: '/api/geography/zip-codes', description: 'Zip codes list' },
  { method: 'GET', path: '/api/geography/neighborhoods', description: 'Neighborhoods list' },
  { method: 'GET', path: '/api/geography/regions', description: 'Regions list' },
  { method: 'GET', path: '/api/geography/metros', description: 'Metro areas list' },
  { method: 'GET', path: '/api/geography/boundaries', description: 'Boundaries data' },
  { method: 'GET', path: '/api/geography/geocode', description: 'Geocoding service' },
];

// =============================================================================
// Census Endpoints (6 sample endpoints)
// =============================================================================

const censusEndpoints: TestEndpoint[] = [
  { method: 'GET', path: '/api/census', description: 'Main census data' },
  { method: 'GET', path: '/api/census/population', description: 'Population data' },
  { method: 'GET', path: '/api/census/demographics', description: 'Demographics data' },
  { method: 'GET', path: '/api/census/housing', description: 'Housing data' },
  { method: 'GET', path: '/api/census/income', description: 'Income data' },
  { method: 'GET', path: '/api/census/education', description: 'Education data' },
];

// =============================================================================
// Economic Endpoints (6 sample endpoints)
// =============================================================================

const economicEndpoints: TestEndpoint[] = [
  { method: 'GET', path: '/api/economic', description: 'Main economic data' },
  { method: 'GET', path: '/api/economic/employment', description: 'Employment data' },
  { method: 'GET', path: '/api/economic/unemployment', description: 'Unemployment data' },
  { method: 'GET', path: '/api/economic/gdp', description: 'GDP data' },
  { method: 'GET', path: '/api/economic/inflation', description: 'Inflation data' },
  { method: 'GET', path: '/api/economic/interest-rates', description: 'Interest rates data' },
];

// =============================================================================
// Test Suite
// =============================================================================

describe('API Endpoints', () => {
  // ---------------------------------------------------------------------------
  // Health Endpoints
  // ---------------------------------------------------------------------------

  describe('Health', () => {
    it.each(healthEndpoints)(
      '$method $path returns 200 status',
      async (endpoint) => {
        const result = await testEndpoint(endpoint);
        expect(result.status).toBe(200);
      },
      TIMEOUT_MS
    );

    it.each(healthEndpoints)(
      '$method $path returns valid JSON',
      async (endpoint) => {
        const result = await testEndpoint(endpoint);
        expect(result.data).toBeDefined();
        expect(typeof result.data).toBe('object');
      },
      TIMEOUT_MS
    );

    it.each(healthEndpoints)(
      '$method $path returns non-empty response',
      async (endpoint) => {
        const result = await testEndpoint(endpoint);
        expect(isNonEmptyResponse(result.data)).toBe(true);
      },
      TIMEOUT_MS
    );

    it.each(healthEndpoints)(
      '$method $path responds within 3 seconds',
      async (endpoint) => {
        const result = await testEndpoint(endpoint);
        expect(result.responseTime).toBeLessThan(MAX_RESPONSE_TIME_MS);
      },
      TIMEOUT_MS
    );
  });

  // ---------------------------------------------------------------------------
  // Metrics Endpoints
  // ---------------------------------------------------------------------------

  describe('Metrics', () => {
    it.each(metricsEndpoints)(
      '$method $path returns 200 status',
      async (endpoint) => {
        const result = await testEndpoint(endpoint);
        expect(result.status).toBe(200);
      },
      TIMEOUT_MS
    );

    it.each(metricsEndpoints)(
      '$method $path returns valid JSON',
      async (endpoint) => {
        const result = await testEndpoint(endpoint);
        expect(result.data).toBeDefined();
        expect(typeof result.data).toBe('object');
      },
      TIMEOUT_MS
    );

    it.each(metricsEndpoints)(
      '$method $path returns non-empty response',
      async (endpoint) => {
        const result = await testEndpoint(endpoint);
        expect(isNonEmptyResponse(result.data)).toBe(true);
      },
      TIMEOUT_MS
    );

    it.each(metricsEndpoints)(
      '$method $path responds within 3 seconds',
      async (endpoint) => {
        const result = await testEndpoint(endpoint);
        expect(result.responseTime).toBeLessThan(MAX_RESPONSE_TIME_MS);
      },
      TIMEOUT_MS
    );
  });

  // ---------------------------------------------------------------------------
  // Scores Endpoints
  // ---------------------------------------------------------------------------

  describe('Scores', () => {
    it.each(scoresEndpoints)(
      '$method $path returns 200 status',
      async (endpoint) => {
        const result = await testEndpoint(endpoint);
        expect(result.status).toBe(200);
      },
      TIMEOUT_MS
    );

    it.each(scoresEndpoints)(
      '$method $path returns valid JSON',
      async (endpoint) => {
        const result = await testEndpoint(endpoint);
        expect(result.data).toBeDefined();
        expect(typeof result.data).toBe('object');
      },
      TIMEOUT_MS
    );

    it.each(scoresEndpoints)(
      '$method $path returns non-empty response',
      async (endpoint) => {
        const result = await testEndpoint(endpoint);
        expect(isNonEmptyResponse(result.data)).toBe(true);
      },
      TIMEOUT_MS
    );

    it.each(scoresEndpoints)(
      '$method $path responds within 3 seconds',
      async (endpoint) => {
        const result = await testEndpoint(endpoint);
        expect(result.responseTime).toBeLessThan(MAX_RESPONSE_TIME_MS);
      },
      TIMEOUT_MS
    );
  });

  // ---------------------------------------------------------------------------
  // Geography Endpoints
  // ---------------------------------------------------------------------------

  describe('Geography', () => {
    it.each(geographyEndpoints)(
      '$method $path returns 200 status',
      async (endpoint) => {
        const result = await testEndpoint(endpoint);
        expect(result.status).toBe(200);
      },
      TIMEOUT_MS
    );

    it.each(geographyEndpoints)(
      '$method $path returns valid JSON',
      async (endpoint) => {
        const result = await testEndpoint(endpoint);
        expect(result.data).toBeDefined();
        expect(typeof result.data).toBe('object');
      },
      TIMEOUT_MS
    );

    it.each(geographyEndpoints)(
      '$method $path returns non-empty response',
      async (endpoint) => {
        const result = await testEndpoint(endpoint);
        expect(isNonEmptyResponse(result.data)).toBe(true);
      },
      TIMEOUT_MS
    );

    it.each(geographyEndpoints)(
      '$method $path responds within 3 seconds',
      async (endpoint) => {
        const result = await testEndpoint(endpoint);
        expect(result.responseTime).toBeLessThan(MAX_RESPONSE_TIME_MS);
      },
      TIMEOUT_MS
    );
  });

  // ---------------------------------------------------------------------------
  // Census Endpoints
  // ---------------------------------------------------------------------------

  describe('Census', () => {
    it.each(censusEndpoints)(
      '$method $path returns 200 status',
      async (endpoint) => {
        const result = await testEndpoint(endpoint);
        expect(result.status).toBe(200);
      },
      TIMEOUT_MS
    );

    it.each(censusEndpoints)(
      '$method $path returns valid JSON',
      async (endpoint) => {
        const result = await testEndpoint(endpoint);
        expect(result.data).toBeDefined();
        expect(typeof result.data).toBe('object');
      },
      TIMEOUT_MS
    );

    it.each(censusEndpoints)(
      '$method $path returns non-empty response',
      async (endpoint) => {
        const result = await testEndpoint(endpoint);
        expect(isNonEmptyResponse(result.data)).toBe(true);
      },
      TIMEOUT_MS
    );

    it.each(censusEndpoints)(
      '$method $path responds within 3 seconds',
      async (endpoint) => {
        const result = await testEndpoint(endpoint);
        expect(result.responseTime).toBeLessThan(MAX_RESPONSE_TIME_MS);
      },
      TIMEOUT_MS
    );
  });

  // ---------------------------------------------------------------------------
  // Economic Endpoints
  // ---------------------------------------------------------------------------

  describe('Economic', () => {
    it.each(economicEndpoints)(
      '$method $path returns 200 status',
      async (endpoint) => {
        const result = await testEndpoint(endpoint);
        expect(result.status).toBe(200);
      },
      TIMEOUT_MS
    );

    it.each(economicEndpoints)(
      '$method $path returns valid JSON',
      async (endpoint) => {
        const result = await testEndpoint(endpoint);
        expect(result.data).toBeDefined();
        expect(typeof result.data).toBe('object');
      },
      TIMEOUT_MS
    );

    it.each(economicEndpoints)(
      '$method $path returns non-empty response',
      async (endpoint) => {
        const result = await testEndpoint(endpoint);
        expect(isNonEmptyResponse(result.data)).toBe(true);
      },
      TIMEOUT_MS
    );

    it.each(economicEndpoints)(
      '$method $path responds within 3 seconds',
      async (endpoint) => {
        const result = await testEndpoint(endpoint);
        expect(result.responseTime).toBeLessThan(MAX_RESPONSE_TIME_MS);
      },
      TIMEOUT_MS
    );
  });
});

// =============================================================================
// Summary Statistics
// =============================================================================

describe('API Endpoint Summary', () => {
  const allEndpoints = [
    ...healthEndpoints,
    ...metricsEndpoints,
    ...scoresEndpoints,
    ...geographyEndpoints,
    ...censusEndpoints,
    ...economicEndpoints,
  ];

  it('should have correct total endpoint count', () => {
    expect(healthEndpoints.length).toBe(7);
    expect(metricsEndpoints.length).toBe(10);
    expect(scoresEndpoints.length).toBe(18);
    expect(geographyEndpoints.length).toBe(10);
    expect(censusEndpoints.length).toBe(6);
    expect(economicEndpoints.length).toBe(6);
    expect(allEndpoints.length).toBe(57);
  });

  it('all endpoints should have valid path format', () => {
    for (const endpoint of allEndpoints) {
      expect(endpoint.path).toMatch(/^\/api\//);
      expect(endpoint.method).toMatch(/^(GET|POST)$/);
    }
  });
});
