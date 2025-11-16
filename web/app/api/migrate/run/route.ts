import { NextRequest, NextResponse } from 'next/server'
import { runPendingMigrations, getExecutedMigrations, ensureMigrationsTable } from '@/lib/database/migration-runner'
import { Migration } from '@/lib/database/migrations'

/**
 * Run pending migrations
 * POST /api/migrate/run
 * 
 * Body: {
 *   migrations: Migration[]  // Array of migration objects
 * }
 * 
 * Or GET to see status
 */
export async function GET() {
  try {
    await ensureMigrationsTable()
    const executed = await getExecutedMigrations()
    
    return NextResponse.json({
      success: true,
      executedMigrations: executed,
      count: executed.length
    })
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error.message
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { migrations } = body
    
    if (!migrations || !Array.isArray(migrations)) {
      return NextResponse.json(
        {
          success: false,
          error: 'migrations array is required'
        },
        { status: 400 }
      )
    }
    
    // Validate migrations
    const validMigrations: Migration[] = migrations.filter((m: any) => {
      return m.name && m.description && typeof m.up === 'function'
    })
    
    if (validMigrations.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'No valid migrations provided'
        },
        { status: 400 }
      )
    }
    
    const result = await runPendingMigrations(validMigrations)
    
    return NextResponse.json({
      success: result.success,
      executed: result.executed,
      failed: result.failed,
      message: result.success
        ? `Successfully executed ${result.executed.length} migration(s)`
        : `Failed to execute ${result.failed.length} migration(s)`
    })
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error.message
      },
      { status: 500 }
    )
  }
}

