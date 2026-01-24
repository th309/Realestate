import { NextRequest, NextResponse } from 'next/server'

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

export async function POST(request: NextRequest) {
  console.log('📥 POST /api/import-redfin - Proxying to Backend')
  try {
    const contentType = request.headers.get('content-type') || ''

    // For file uploads, we need to handle multipart/form-data
    // BUT, passing multipart to backend via fetch in Next.js edge/node environment can be tricky.
    // The easiest way is to read the file content here and send it as JSON string if it's not too huge.
    // Given the constraints, I will simplify:

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData()
      const file = formData.get('file') as File
      const metricName = (formData.get('metricName') as string) || ''
      const limitRows = formData.get('limitRows') ? parseInt(formData.get('limitRows') as string) : undefined

      if (!file) {
        return NextResponse.json({ success: false, message: 'No file provided' }, { status: 400 })
      }

      const text = await file.text()

      // Send to backend
      const response = await fetch(`${BACKEND_URL}/data-ingestion/redfin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          metric: metricName,
          limit: limitRows,
          csvContent: text
        })
      });

      const result = await response.json()
      return NextResponse.json(result, { status: response.status })
    } else {
      // JSON Body
      const body = await request.json()
      const response = await fetch(`${BACKEND_URL}/data-ingestion/redfin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      const result = await response.json()
      return NextResponse.json(result, { status: response.status })
    }

  } catch (error: any) {
    console.error('Redfin proxy error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  // Legacy GET support for discovery/test
  // For now, we return 501 or just legacy message
  return NextResponse.json({
    success: false,
    message: 'GET method deprecated. Use POST to trigger imports via Backend.'
  }, { status: 405 })
}

