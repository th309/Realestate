'use client'

import { useState } from 'react'

export default function SimpleTestPage() {
  const [result, setResult] = useState<string>('No test run yet')

  return (
    <div className="min-h-screen p-8 bg-gray-50">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Simple Test Page</h1>
        
        <div className="space-y-4">
          <button
            onClick={() => setResult('Button clicked!')}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Test Button
          </button>
          
          <button
            onClick={async () => {
              try {
                const response = await fetch('/api/test-db')
                const data = await response.json()
                setResult(JSON.stringify(data, null, 2))
              } catch (error: any) {
                setResult(`Error: ${error.message}`)
              }
            }}
            className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 ml-4"
          >
            Test Database
          </button>
        </div>
        
        <div className="mt-8 p-4 bg-white rounded-lg shadow">
          <h2 className="font-semibold mb-2">Result:</h2>
          <pre className="whitespace-pre-wrap">{result}</pre>
        </div>
      </div>
    </div>
  )
}
