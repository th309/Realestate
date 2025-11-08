'use client'

import { useState } from 'react'

export default function TestPage() {
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)

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

  return (
    <div className="min-h-screen p-8 bg-gray-50">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Database Connection Test</h1>
        
        <div className="flex gap-4 mb-6">
          <button
            onClick={testConnection}
            disabled={loading}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Testing...' : 'Test Database Connection'}
          </button>
          
          <button
            onClick={setupTestData}
            disabled={loading}
            className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Setting up...' : 'Insert Test Data (10 Markets)'}
          </button>
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
                <ul className="list-disc list-inside space-y-1 text-gray-700">
                  <li>Tier Configs Found: {result.details.tierConfigsFound}</li>
                  <li>Geo Data Count: {result.details.geoDataCount}</li>
                  <li>Scores Count: {result.details.scoresCount}</li>
                </ul>
                
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
            
            <pre className="mt-4 p-4 bg-gray-100 rounded text-xs overflow-auto">
              {JSON.stringify(result, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  )
}

