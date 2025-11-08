import { NextResponse } from 'next/server'

export async function GET() {
  try {
    // Basic health check - no external dependencies
    return NextResponse.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      environment: {
        nodeVersion: process.version,
        env: process.env.NODE_ENV || 'development'
      }
    })
  } catch (error: any) {
    return NextResponse.json({
      status: 'error',
      error: error.message
    }, { status: 500 })
  }
}
