'use client'

import { useState } from 'react'

export default function TestPage() {
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [zillowDatasets, setZillowDatasets] = useState('zhvi')
  const [storeData, setStoreData] = useState(false)

  const testConnection = async () => {
    setLoading(true)
    setResult(null)
    try {
      const response = await fetch('/api/test-db')
      const data = await response.json()
      setResult(data)
    } catch (error: any) {
      setResult({
        success: false,
        error: error.message
      })
    } finally {
      setLoading(false)
    }
  }

  const setupTestData = async () => {
    setLoading(true)
    setResult(null)
    try {
      const response = await fetch('/api/setup-test-data', {
        method: 'POST'
      })
      const data = await response.json()
      setResult(data)
    } catch (error: any) {
      setResult({
        success: false,
        error: error.message
      })
    } finally {
      setLoading(false)
    }
  }

  const verifyTestData = async () => {
    setLoading(true)
    setResult(null)
    try {
      const response = await fetch('/api/verify-test-data')
      const data = await response.json()
      setResult(data)
    } catch (error: any) {
      setResult({
        success: false,
        error: error.message
      })
    } finally {
      setLoading(false)
    }
  }

  const testZillowFetcher = async () => {
    setLoading(true)
    setResult(null)
    try {
      const datasets = zillowDatasets.split(',').map(d => d.trim()).join(',')
      const storeParam = storeData ? 'true' : 'false'
      // Use simplified version for now
      const response = await fetch(`/api/test-zillow-simple?datasets=${datasets}&store=${storeParam}`)
      const data = await response.json()
      setResult(data)
    } catch (error: any) {
      setResult({
        success: false,
        error: error.message
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen p-8 bg-gray-50">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Development Test Page</h1>
        
        {/* Database Tests */}
        <div className="mb-8 p-6 bg-white rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">Database Tests</h2>
          <div className="flex flex-wrap gap-4">
            <button
              onClick={testConnection}
              disabled={loading}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Testing...' : 'Test Connection'}
            </button>
            
            <button
              onClick={setupTestData}
              disabled={loading}
              className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Setting up...' : 'Insert Test Data'}
            </button>
            
            <button
              onClick={verifyTestData}
              disabled={loading}
              className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Verifying...' : 'Verify Data'}
            </button>
          </div>
        </div>

        {/* Zillow Import Test */}
        <div className="mb-8 p-6 bg-white rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">Zillow Data Import (New Schema)</h2>
          <div className="space-y-4">
            <button
              onClick={async () => {
                setLoading(true)
                try {
                  const response = await fetch('/api/import-zillow?test=true')
                  const data = await response.json()
                  setResult(data)
                } catch (error: any) {
                  setResult({ success: false, error: error.message })
                } finally {
                  setLoading(false)
                }
              }}
              disabled={loading}
              className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Importing...' : 'Test Import (50 regions)'}
            </button>
            
            <button
              onClick={async () => {
                setLoading(true)
                try {
                  const response = await fetch('/api/import-zillow?metric=zhvi&limit=50')
                  const data = await response.json()
                  setResult(data)
                } catch (error: any) {
                  setResult({ success: false, error: error.message })
                } finally {
                  setLoading(false)
                }
              }}
              disabled={loading}
              className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed ml-4"
            >
              {loading ? 'Importing...' : 'Import 50 Regions'}
            </button>
          </div>
        </div>

        {/* FRED Import Test */}
        <div className="mb-8 p-6 bg-white rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">FRED Data Import (Phase 2.2)</h2>
          <div className="space-y-4">
            <button
              onClick={async () => {
                setLoading(true)
                try {
                  const response = await fetch('/api/import-fred?series=mortgage_rate_30yr')
                  const data = await response.json()
                  setResult(data)
                } catch (error: any) {
                  setResult({ success: false, error: error.message })
                } finally {
                  setLoading(false)
                }
              }}
              disabled={loading}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Importing...' : 'Import 30-Year Mortgage Rates'}
            </button>
            
            <button
              onClick={async () => {
                setLoading(true)
                try {
                  const response = await fetch('/api/import-fred?series=mortgage_rate_30yr,mortgage_rate_15yr')
                  const data = await response.json()
                  setResult(data)
                } catch (error: any) {
                  setResult({ success: false, error: error.message })
                } finally {
                  setLoading(false)
                }
              }}
              disabled={loading}
              className="px-6 py-3 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 disabled:opacity-50 disabled:cursor-not-allowed ml-4"
            >
              {loading ? 'Importing...' : 'Import All Mortgage Rates'}
            </button>
          </div>
        </div>

        {/* Census Import Test */}
        <div className="mb-8 p-6 bg-white rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">Census Data Import (Phase 2.2)</h2>
          <div className="space-y-4">
            <button
              onClick={async () => {
                setLoading(true)
                try {
                  const response = await fetch('/api/import-census?variables=population,median_household_income&year=2022&geo_level=metropolitan statistical area/micropolitan statistical area')
                  const data = await response.json()
                  setResult(data)
                } catch (error: any) {
                  setResult({ success: false, error: error.message })
                } finally {
                  setLoading(false)
                }
              }}
              disabled={loading}
              className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Importing...' : 'Import Metro Demographics (2022)'}
            </button>
            
            <button
              onClick={async () => {
                setLoading(true)
                try {
                  const response = await fetch('/api/import-census?variables=population&year=2022&geo_level=state')
                  const data = await response.json()
                  setResult(data)
                } catch (error: any) {
                  setResult({ success: false, error: error.message })
                } finally {
                  setLoading(false)
                }
              }}
              disabled={loading}
              className="px-6 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed ml-4"
            >
              {loading ? 'Importing...' : 'Import State Population (2022)'}
            </button>
          </div>
        </div>
        
        {/* Zillow Structure Analysis */}
        <div className="mb-8 p-6 bg-white rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">Zillow Data Structure Analysis</h2>
          <button
            onClick={async () => {
              setLoading(true)
              try {
                const response = await fetch('/api/analyze-zillow')
                const data = await response.json()
                setResult(data)
              } catch (error: any) {
                setResult({ success: false, error: error.message })
              } finally {
                setLoading(false)
              }
            }}
            disabled={loading}
            className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed mb-4"
          >
            {loading ? 'Analyzing...' : 'Analyze Zillow CSV Structure'}
          </button>
        </div>
        
        {/* Zillow Fetcher Tests */}
        <div className="mb-8 p-6 bg-white rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">Zillow Data Fetcher Test (Phase 2.1) - Simplified</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                Datasets (comma-separated):
              </label>
              <input
                type="text"
                value={zillowDatasets}
                onChange={(e) => setZillowDatasets(e.target.value)}
                placeholder="zhvi, inventory, zori"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={loading}
              />
              <p className="text-xs text-gray-500 mt-1">
                Options: zhvi, zori, inventory, daysOnMarket, priceCuts
              </p>
            </div>
            
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="storeData"
                checked={storeData}
                onChange={(e) => setStoreData(e.target.checked)}
                disabled={loading}
                className="w-4 h-4"
              />
              <label htmlFor="storeData" className="text-sm">
                Store data in database (default: fetch only)
              </label>
            </div>
            
            <button
              onClick={testZillowFetcher}
              disabled={loading}
              className="px-6 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Fetching Zillow Data...' : 'Test Zillow Fetcher'}
            </button>
          </div>
        </div>

        {result && (
          <div className={`p-6 rounded-lg ${
            result.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
          }`}>
            <h2 className={`text-xl font-semibold mb-4 ${
              result.success ? 'text-green-800' : 'text-red-800'
            }`}>
              {result.success ? '✓ Connection Successful!' : '✗ Connection Failed'}
            </h2>
            
            {result.message && (
              <p className="mb-4 text-gray-700">{result.message}</p>
            )}
            
            {result.error && (
              <div className="mb-4">
                <p className="font-semibold text-red-800 mb-2">Error:</p>
                <pre className="bg-red-100 p-3 rounded text-sm overflow-auto">
                  {result.error}
                </pre>
              </div>
            )}
            
            {result.details && (
              <div className="space-y-2">
                <h3 className="font-semibold text-gray-800">Details:</h3>
                
                {/* Show error details if present */}
                {result.details.errorDetails && result.details.errorDetails.length > 0 && (
                  <div className="mt-4 p-3 bg-red-100 rounded">
                    <h4 className="font-semibold text-red-800 mb-2">Error Details:</h4>
                    {result.details.errorDetails.slice(0, 3).map((err: any, idx: number) => (
                      <div key={idx} className="mb-2 text-sm">
                        <p className="font-medium">Region {err.region}:</p>
                        <p className="text-red-700">{err.error}</p>
                        {err.hint && <p className="text-red-600">Hint: {err.hint}</p>}
                        {err.code && <p className="text-red-600">Code: {err.code}</p>}
                      </div>
                    ))}
                  </div>
                )}
                
                {result.details.tierConfigsFound !== undefined && (
                  <ul className="list-disc list-inside space-y-1 text-gray-700">
                    <li>Tier Configs Found: {result.details.tierConfigsFound}</li>
                    <li>Geo Data Count: {result.details.geoDataCount}</li>
                    <li>Scores Count: {result.details.scoresCount}</li>
                  </ul>
                )}
                
                {result.details.totalDataPoints !== undefined && (
                  <ul className="list-disc list-inside space-y-1 text-gray-700">
                    <li>Total Data Points: {result.details.totalDataPoints}</li>
                    <li>Datasets: {result.details.datasets?.join(', ')}</li>
                    <li>Duration: {result.details.durationMs}ms</li>
                    <li>Stored: {result.details.stored || 0} records</li>
                    <li>Sample Size: {result.details.sampleSize}</li>
                  </ul>
                )}
                
                {result.details.environment && (
                  <div className="mt-4 pt-4 border-t border-gray-300">
                    <h4 className="font-semibold text-gray-800 mb-2">Environment Variables:</h4>
                    <ul className="space-y-1 text-sm">
                      <li>Supabase URL: {result.details.environment.supabaseUrl}</li>
                      <li>Anon Key: {result.details.environment.anonKey}</li>
                      <li>Service Key: {result.details.environment.serviceKey}</li>
                    </ul>
                  </div>
                )}
              </div>
            )}
            
            {result.sample && Array.isArray(result.sample) && result.sample.length > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-300">
                <h4 className="font-semibold text-gray-800 mb-2">Sample Data ({result.sample.length} records):</h4>
                <div className="bg-gray-100 p-3 rounded text-xs overflow-auto max-h-40">
                  <pre>{JSON.stringify(result.sample, null, 2)}</pre>
                </div>
              </div>
            )}
            
            <pre className="mt-4 p-4 bg-gray-100 rounded text-xs overflow-auto">
              {JSON.stringify(result, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  )
}

