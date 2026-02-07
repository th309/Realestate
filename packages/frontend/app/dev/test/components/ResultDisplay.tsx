'use client';

import type { TestResult } from './types';

interface ResultDisplayProps {
  result: TestResult | null;
}

export function ResultDisplay({ result }: ResultDisplayProps) {
  if (!result) return null;

  return (
    <div className={`p-6 rounded-lg ${
      result.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
    }`}>
      <ResultHeader result={result} />
      {result.summary && <SummarySection summary={result.summary} />}
      {result.marketsByType && result.marketsByType.length > 0 && (
        <MarketsByTypeSection marketsByType={result.marketsByType} />
      )}
      {result.metricsBreakdown && result.metricsBreakdown.length > 0 && (
        <MetricsBreakdownSection metricsBreakdown={result.metricsBreakdown} />
      )}
      {result.sampleRecords && result.sampleRecords.length > 0 && (
        <SampleRecordsSection
          sampleRecords={result.sampleRecords}
          recordCount={result.recordCount}
          totalRecords={result.details?.totalRecords}
        />
      )}
      {result.message && <p className="mb-4 text-gray-700">{result.message}</p>}
      {result.error && <ErrorSection error={result.error} />}
      {result.details && <DetailsSection details={result.details} />}
      {result.sample && Array.isArray(result.sample) && result.sample.length > 0 && (
        <SampleDataSection sample={result.sample} />
      )}
      <RawJsonSection result={result} />
    </div>
  );
}

function ResultHeader({ result }: { result: TestResult }) {
  return (
    <h2 className={`text-xl font-semibold mb-4 ${
      result.success ? 'text-green-800' : 'text-red-800'
    }`}>
      {result.success
        ? (result.summary ? 'Redfin Data Verification' : 'Connection Successful!')
        : 'Connection Failed'}
    </h2>
  );
}

function SummarySection({ summary }: { summary: NonNullable<TestResult['summary']> }) {
  return (
    <div className="mb-6 p-4 bg-white rounded border border-gray-200">
      <h3 className="text-lg font-semibold mb-3 text-gray-800">Summary</h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        <StatCard value={summary.totalMarkets} label="Total Markets" color="blue" />
        <StatCard value={summary.totalTimeSeriesRecords.toLocaleString()} label="Time Series Records" color="green" />
        <StatCard value={summary.uniqueRegionsWithData} label="Regions with Data" color="purple" />
        <StatCard value={summary.dateRange.totalMonths} label="Unique Months" color="orange" />
      </div>
      {summary.dateRange.min && summary.dateRange.max && (
        <div className="text-sm text-gray-600">
          <strong>Date Range:</strong> {summary.dateRange.min} to {summary.dateRange.max}
        </div>
      )}
    </div>
  );
}

function StatCard({ value, label, color }: { value: string | number; label: string; color: string }) {
  const colorClass = {
    blue: 'text-blue-600',
    green: 'text-green-600',
    purple: 'text-purple-600',
    orange: 'text-orange-600'
  }[color] || 'text-gray-600';

  return (
    <div>
      <div className={`text-2xl font-bold ${colorClass}`}>{value}</div>
      <div className="text-sm text-gray-600">{label}</div>
    </div>
  );
}

function MarketsByTypeSection({ marketsByType }: { marketsByType: NonNullable<TestResult['marketsByType']> }) {
  return (
    <div className="mb-6 p-4 bg-white rounded border border-gray-200">
      <h3 className="text-lg font-semibold mb-3 text-gray-800">Markets by Type</h3>
      <div className="space-y-3">
        {marketsByType.map((typeGroup, idx) => (
          <div key={idx} className="border-b pb-2 last:border-0">
            <div className="flex justify-between items-center mb-1">
              <span className="font-semibold capitalize">{typeGroup.type}</span>
              <span className="text-blue-600 font-bold">{typeGroup.count} markets</span>
            </div>
            <div className="text-sm text-gray-600 ml-4">
              Sample: {typeGroup.sample.map((s) => `${s.name}${s.state ? ` (${s.state})` : ''}`).join(', ')}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MetricsBreakdownSection({ metricsBreakdown }: { metricsBreakdown: NonNullable<TestResult['metricsBreakdown']> }) {
  return (
    <div className="mb-6 p-4 bg-white rounded border border-gray-200">
      <h3 className="text-lg font-semibold mb-3 text-gray-800">Metrics Breakdown</h3>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="text-left py-2 px-3">Metric</th>
              <th className="text-right py-2 px-3">Records</th>
              <th className="text-left py-2 px-3">Date Range</th>
              <th className="text-left py-2 px-3">Sample Values</th>
            </tr>
          </thead>
          <tbody>
            {metricsBreakdown.map((metric, idx) => (
              <tr key={idx} className="border-b">
                <td className="py-2 px-3 font-mono text-xs">{metric.metric}</td>
                <td className="text-right py-2 px-3">{metric.count.toLocaleString()}</td>
                <td className="py-2 px-3 text-xs">
                  {metric.dateRange.min && metric.dateRange.max
                    ? `${metric.dateRange.min} to ${metric.dateRange.max}`
                    : 'N/A'}
                </td>
                <td className="py-2 px-3 text-xs">
                  {metric.sampleValues.length > 0
                    ? metric.sampleValues.map((v) => typeof v === 'number' ? v.toLocaleString() : v).join(', ')
                    : 'N/A'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SampleRecordsSection({
  sampleRecords,
  recordCount,
  totalRecords
}: {
  sampleRecords: NonNullable<TestResult['sampleRecords']>;
  recordCount?: number;
  totalRecords?: number;
}) {
  return (
    <div className="mb-6 p-4 bg-white rounded border border-gray-200">
      <h3 className="text-lg font-semibold mb-3 text-gray-800">
        Records {recordCount ? `(${recordCount.toLocaleString()} shown)` : ''}
      </h3>
      <div className="overflow-x-auto max-h-96 overflow-y-auto">
        <table className="min-w-full text-sm">
          <thead className="sticky top-0 bg-gray-100">
            <tr className="border-b">
              <th className="text-left py-2 px-3">Region</th>
              <th className="text-left py-2 px-3">Type</th>
              <th className="text-left py-2 px-3">State</th>
              <th className="text-left py-2 px-3">Date</th>
              <th className="text-left py-2 px-3">Metric</th>
              <th className="text-right py-2 px-3">Value</th>
              <th className="text-left py-2 px-3">Region ID</th>
            </tr>
          </thead>
          <tbody>
            {sampleRecords.map((record, idx) => (
              <tr key={idx} className="border-b hover:bg-gray-50">
                <td className="py-2 px-3">{record.region}</td>
                <td className="py-2 px-3 capitalize text-xs">{record.regionType || 'N/A'}</td>
                <td className="py-2 px-3">{record.state || 'N/A'}</td>
                <td className="py-2 px-3 text-xs">{record.date}</td>
                <td className="py-2 px-3 font-mono text-xs">{record.metric}</td>
                <td className="text-right py-2 px-3">
                  {typeof record.value === 'number' ? record.value.toLocaleString() : record.value || 'N/A'}
                </td>
                <td className="py-2 px-3 font-mono text-xs text-gray-500">{record.regionId}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {recordCount && recordCount >= 10000 && (
        <p className="text-xs text-gray-500 mt-2">
          Showing first 10,000 records. Total records: {totalRecords?.toLocaleString() || 'N/A'}
        </p>
      )}
      {recordCount && recordCount < 10000 && totalRecords && recordCount < totalRecords && (
        <p className="text-xs text-gray-500 mt-2">
          Showing {recordCount.toLocaleString()} of {totalRecords.toLocaleString()} total records
        </p>
      )}
    </div>
  );
}

function ErrorSection({ error }: { error: string }) {
  return (
    <div className="mb-4">
      <p className="font-semibold text-red-800 mb-2">Error:</p>
      <pre className="bg-red-100 p-3 rounded text-sm overflow-auto">{error}</pre>
    </div>
  );
}

function DetailsSection({ details }: { details: NonNullable<TestResult['details']> }) {
  return (
    <div className="space-y-2">
      <h3 className="font-semibold text-gray-800">Details:</h3>

      {details.errorDetails && details.errorDetails.length > 0 && (
        <div className="mt-4 p-3 bg-red-100 rounded">
          <h4 className="font-semibold text-red-800 mb-2">Error Details:</h4>
          {details.errorDetails.slice(0, 3).map((err, idx) => (
            <div key={idx} className="mb-2 text-sm">
              <p className="font-medium">Region {err.region}:</p>
              <p className="text-red-700">{err.error}</p>
              {err.hint && <p className="text-red-600">Hint: {err.hint}</p>}
              {err.code && <p className="text-red-600">Code: {err.code}</p>}
            </div>
          ))}
        </div>
      )}

      {details.tierConfigsFound !== undefined && (
        <ul className="list-disc list-inside space-y-1 text-gray-700">
          <li>Tier Configs Found: {details.tierConfigsFound}</li>
          <li>Geo Data Count: {details.geoDataCount}</li>
          <li>Scores Count: {details.scoresCount}</li>
        </ul>
      )}

      {details.totalDataPoints !== undefined && (
        <ul className="list-disc list-inside space-y-1 text-gray-700">
          <li>Total Data Points: {details.totalDataPoints}</li>
          <li>Datasets: {details.datasets?.join(', ')}</li>
          <li>Duration: {details.durationMs}ms</li>
          <li>Stored: {details.stored || 0} records</li>
          <li>Sample Size: {details.sampleSize}</li>
        </ul>
      )}

      {details.environment && (
        <div className="mt-4 pt-4 border-t border-gray-300">
          <h4 className="font-semibold text-gray-800 mb-2">Environment Variables:</h4>
          <ul className="space-y-1 text-sm">
            <li>Supabase URL: {details.environment.supabaseUrl}</li>
            <li>Anon Key: {details.environment.anonKey}</li>
            <li>Service Key: {details.environment.serviceKey}</li>
          </ul>
        </div>
      )}
    </div>
  );
}

function SampleDataSection({ sample }: { sample: any[] }) {
  return (
    <div className="mt-4 pt-4 border-t border-gray-300">
      <h4 className="font-semibold text-gray-800 mb-2">Sample Data ({sample.length} records):</h4>
      <div className="bg-gray-100 p-3 rounded text-xs overflow-auto max-h-40">
        <pre>{JSON.stringify(sample, null, 2)}</pre>
      </div>
    </div>
  );
}

function RawJsonSection({ result }: { result: TestResult }) {
  return (
    <pre className="mt-4 p-4 bg-gray-100 rounded text-xs overflow-auto">
      {JSON.stringify(result, null, 2)}
    </pre>
  );
}
