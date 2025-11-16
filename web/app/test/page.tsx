'use client'

import { useState } from 'react'

export default function TestPage() {
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<number | null>(null)
  const [importProgress, setImportProgress] = useState<{ current: number; total: number; percent: number; message: string } | null>(null)
  const [uploadedFiles, setUploadedFiles] = useState<Array<{ filename: string; timestamp: Date; result: any }>>([])
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
                  const response = await fetch('/api/count-census-metros?year=2022')
                  const data = await response.json()
                  setResult(data)
                } catch (error: any) {
                  setResult({ success: false, error: error.message })
                } finally {
                  setLoading(false)
                }
              }}
              disabled={loading}
              className="px-6 py-3 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Counting...' : 'Count Metro Areas in Census Data'}
            </button>
            
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
              className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed ml-4"
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

        {/* Redfin Import Test */}
        <div className="mb-8 p-6 bg-white rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">Redfin Data Import (Phase 2.2)</h2>
          
          {/* Verification and Clear Buttons */}
          <div className="mb-4 pb-4 border-b flex flex-wrap gap-4 items-end">
            <div>
              <button
                onClick={async () => {
                  setLoading(true)
                  setResult(null)
                  try {
                    const response = await fetch('/api/verify-redfin-data')
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
                }}
                disabled={loading}
                className="px-6 py-3 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Verifying...' : '🔍 Verify Redfin Data'}
              </button>
              <p className="text-xs text-gray-500 mt-1">
                Check imported data
              </p>
            </div>
            <div>
              <button
                onClick={async () => {
                  if (!confirm('⚠️ WARNING: This will delete ALL Redfin data from the database (markets and time series records).\n\nThis action cannot be undone. Are you sure?')) {
                    return
                  }
                  if (!confirm('Are you absolutely sure? This will permanently delete all Redfin data.')) {
                    return
                  }
                  setLoading(true)
                  setResult(null)
                  try {
                    const response = await fetch('/api/clear-redfin-data?confirm=true', {
                      method: 'DELETE'
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
                }}
                disabled={loading}
                className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Deleting...' : '🗑️ Clear All Redfin Data'}
              </button>
              <p className="text-xs text-gray-500 mt-1">
                Delete all Redfin data
              </p>
            </div>
          </div>
          
          <div className="mt-6 p-6 bg-blue-50 border-2 border-blue-200 rounded-lg">
              <h3 className="text-lg font-semibold mb-3 text-blue-900">📁 Manual File Upload</h3>
              <p className="text-sm text-gray-700 mb-4">
                Download a CSV/TSV file from <a href="https://www.redfin.com/news/data-center/" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">Redfin Data Center</a>, then upload it here:
              </p>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Metric Name (optional - will auto-detect from file if not provided):
                  </label>
                  <input
                    type="text"
                    id="redfin-metric-name"
                    placeholder="e.g., median_sale_price, homes_sold, inventory"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    disabled={loading}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Leave empty to let the importer auto-detect metrics from the file
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <label className="cursor-pointer">
                    <input
                      type="file"
                      accept=".csv,.tsv"
                      onChange={async (e) => {
                        const file = e.target.files?.[0]
                        if (!file) return
                        
                        setLoading(true)
                        setImportProgress(null)
                        setResult(null)
                        try {
                          const formData = new FormData()
                          formData.append('file', file)
                          const metricNameInput = document.getElementById('redfin-metric-name') as HTMLInputElement
                          const metricName = metricNameInput?.value?.trim() || ''
                          if (metricName) {
                            formData.append('metricName', metricName)
                          } else {
                            // Empty string means auto-detect all metrics from file
                            formData.append('metricName', '')
                          }
                          // No limitRows - import all records

                        // Use fetch with streaming for SSE
                        const response = await fetch('/api/import-redfin', {
                          method: 'POST',
                          body: formData
                        })

                        if (!response.ok) {
                          throw new Error(`Upload failed: ${response.statusText}`)
                        }

                        // Check if response is SSE
                        const contentType = response.headers.get('content-type') || ''
                        if (contentType.includes('text/event-stream')) {
                          // Stream SSE events
                          const reader = response.body?.getReader()
                          const decoder = new TextDecoder()
                          let buffer = ''

                          if (!reader) {
                            throw new Error('No response body reader available')
                          }

                          while (true) {
                            const { done, value } = await reader.read()
                            if (done) break

                            buffer += decoder.decode(value, { stream: true })
                            const lines = buffer.split('\n')
                            buffer = lines.pop() || '' // Keep incomplete line in buffer

                            for (const line of lines) {
                              if (line.startsWith('data: ')) {
                                try {
                                  const data = JSON.parse(line.substring(6))
                                  
                                  if (data.type === 'progress' && data.progress) {
                                    setImportProgress({
                                      current: data.progress.current,
                                      total: data.progress.total,
                                      percent: data.progress.percent,
                                      message: data.message
                                    })
                                  } else if (data.type === 'complete') {
                                    setResult(data.result)
                                    setImportProgress(null)
                                    // Store uploaded file info
                                    if (data.result.sourceFileName) {
                                      setUploadedFiles(prev => [...prev, {
                                        filename: data.result.sourceFileName,
                                        timestamp: new Date(),
                                        result: data.result
                                      }])
                                    }
                                  } else if (data.type === 'error') {
                                    setResult({ success: false, error: data.error })
                                    setImportProgress(null)
                                    throw new Error(data.error)
                                  }
                                } catch (parseError) {
                                  // Skip invalid JSON lines
                                }
                              }
                            }
                          }
                        } else {
                          // Handle regular JSON response
                          const responseJson = await response.json()
                          setResult(responseJson)
                        }
                      } catch (error: any) {
                        setResult({ success: false, error: error.message })
                      } finally {
                        setLoading(false)
                        setUploadProgress(null)
                        e.target.value = '' // Reset file input
                      }
                    }}
                    disabled={loading}
                    className="hidden"
                    id="redfin-file-upload"
                  />
                    <span className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed inline-block">
                      {loading ? 'Uploading...' : '📤 Choose CSV File to Upload'}
                    </span>
                  </label>
                  <span className="text-sm text-gray-600">
                    Supports both <strong>"data"</strong> and <strong>"cross tab"</strong> formats. Full import (no row limit).
                  </span>
                </div>
              </div>
              {uploadProgress !== null && (
                <div className="mt-4 w-full">
                  <div className="flex items-center justify-between text-sm text-gray-700 mb-1">
                    <span>Upload progress</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-600 transition-all duration-200"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}
              {importProgress !== null && (
                <div className="mt-4 w-full">
                  <div className="flex items-center justify-between text-sm text-gray-700 mb-1">
                    <span>{importProgress.message}</span>
                    <span>{importProgress.percent}%</span>
                  </div>
                  <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-green-600 transition-all duration-300"
                      style={{ width: `${importProgress.percent}%` }}
                    />
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    Batch {importProgress.current} of {importProgress.total}
                  </div>
                </div>
              )}
              <p className="text-xs text-gray-500 mt-3">
                💡 Tip: After downloading from Redfin, use this button to select and upload the file
              </p>
            </div>
            
            {/* Uploaded Files List */}
            {uploadedFiles.length > 0 && (
              <div className="mt-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
                <h3 className="text-md font-semibold mb-3 text-gray-800">📋 Uploaded Files</h3>
                <div className="space-y-2">
                  {uploadedFiles.map((file, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 bg-white rounded border border-gray-200">
                      <div className="flex-1">
                        <div className="font-medium text-sm">{file.filename}</div>
                        <div className="text-xs text-gray-500">
                          {file.timestamp.toLocaleString()} • 
                          {file.result?.details?.timeSeriesInserted || 0} records
                        </div>
                      </div>
                      <div className="ml-4 flex gap-2">
                        <button
                          onClick={async () => {
                            setLoading(true)
                            setResult(null)
                            try {
                              const response = await fetch(`/api/verify-redfin-data?filename=${encodeURIComponent(file.filename)}`)
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
                          }}
                          disabled={loading}
                          className="px-4 py-2 bg-teal-600 text-white rounded hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                        >
                          Verify
                        </button>
                        <button
                          onClick={async () => {
                            setLoading(true)
                            setResult(null)
                            try {
                              // Fetch all records from this file (up to 10,000)
                              const response = await fetch(`/api/verify-redfin-data?filename=${encodeURIComponent(file.filename)}&limit=10000&showAll=true`)
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
                          }}
                          disabled={loading}
                          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                        >
                          View All Records
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
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
              {result.success ? (result.summary ? '✓ Redfin Data Verification' : '✓ Connection Successful!') : '✗ Connection Failed'}
            </h2>
            
            {/* Redfin Verification Summary */}
            {result.summary && (
              <div className="mb-6 p-4 bg-white rounded border border-gray-200">
                <h3 className="text-lg font-semibold mb-3 text-gray-800">📊 Summary</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div>
                    <div className="text-2xl font-bold text-blue-600">{result.summary.totalMarkets}</div>
                    <div className="text-sm text-gray-600">Total Markets</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-green-600">{result.summary.totalTimeSeriesRecords.toLocaleString()}</div>
                    <div className="text-sm text-gray-600">Time Series Records</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-purple-600">{result.summary.uniqueRegionsWithData}</div>
                    <div className="text-sm text-gray-600">Regions with Data</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-orange-600">{result.summary.dateRange.totalMonths}</div>
                    <div className="text-sm text-gray-600">Unique Months</div>
                  </div>
                </div>
                {result.summary.dateRange.min && result.summary.dateRange.max && (
                  <div className="text-sm text-gray-600">
                    <strong>Date Range:</strong> {result.summary.dateRange.min} to {result.summary.dateRange.max}
                  </div>
                )}
              </div>
            )}
            
            {/* Markets by Type */}
            {result.marketsByType && result.marketsByType.length > 0 && (
              <div className="mb-6 p-4 bg-white rounded border border-gray-200">
                <h3 className="text-lg font-semibold mb-3 text-gray-800">🏙️ Markets by Type</h3>
                <div className="space-y-3">
                  {result.marketsByType.map((typeGroup: any, idx: number) => (
                    <div key={idx} className="border-b pb-2 last:border-0">
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-semibold capitalize">{typeGroup.type}</span>
                        <span className="text-blue-600 font-bold">{typeGroup.count} markets</span>
                      </div>
                      <div className="text-sm text-gray-600 ml-4">
                        Sample: {typeGroup.sample.map((s: any) => `${s.name}${s.state ? ` (${s.state})` : ''}`).join(', ')}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Metrics Breakdown */}
            {result.metricsBreakdown && result.metricsBreakdown.length > 0 && (
              <div className="mb-6 p-4 bg-white rounded border border-gray-200">
                <h3 className="text-lg font-semibold mb-3 text-gray-800">📈 Metrics Breakdown</h3>
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
                      {result.metricsBreakdown.map((metric: any, idx: number) => (
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
                              ? metric.sampleValues.map((v: number) => typeof v === 'number' ? v.toLocaleString() : v).join(', ')
                              : 'N/A'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            
            {/* Sample Records */}
            {result.sampleRecords && result.sampleRecords.length > 0 && (
              <div className="mb-6 p-4 bg-white rounded border border-gray-200">
                <h3 className="text-lg font-semibold mb-3 text-gray-800">
                  🔍 Records {result.recordCount ? `(${result.recordCount.toLocaleString()} shown)` : ''}
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
                      {result.sampleRecords.map((record: any, idx: number) => (
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
                {result.recordCount && result.recordCount >= 10000 && (
                  <p className="text-xs text-gray-500 mt-2">
                    Showing first 10,000 records. Total records: {result.details?.totalRecords?.toLocaleString() || 'N/A'}
                  </p>
                )}
                {result.recordCount && result.recordCount < 10000 && result.details?.totalRecords && result.recordCount < result.details.totalRecords && (
                  <p className="text-xs text-gray-500 mt-2">
                    Showing {result.recordCount.toLocaleString()} of {result.details.totalRecords.toLocaleString()} total records
                  </p>
                )}
              </div>
            )}
            
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

