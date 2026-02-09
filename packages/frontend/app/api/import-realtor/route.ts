import { NextResponse } from 'next/server'

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

export async function POST(request: Request) {
    try {
        const { searchParams } = new URL(request.url)
        const body = await request.json().catch(() => ({}))

        // Allow datasetId/limit via query params or body
        const datasetId = body.datasetId || searchParams.get('datasetId')
        const limit = body.limit || searchParams.get('limit')

        console.log(`🚀 Starting Realtor import via Backend API: ${datasetId || 'ALL'}`)

        const response = await fetch(`${BACKEND_URL}/api/data-ingestion/realtor`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                datasetId,
                limit: limit ? parseInt(limit.toString()) : undefined
            })
        })

        const result = await response.json()
        return NextResponse.json(result, { status: response.status })

    } catch (error: any) {
        console.error('❌ Realtor proxy error:', error)
        return NextResponse.json({
            success: false,
            error: error.message,
        }, { status: 500 })
    }
}
