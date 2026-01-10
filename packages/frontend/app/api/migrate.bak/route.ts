import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { SchemaBuilder, executeSQL } from '@/lib/database/migrations'

/**
 * Database Migration API
 * POST /api/migrate
 * 
 * Body: {
 *   action: 'create_table' | 'alter_table' | 'add_column' | 'drop_column' | 'custom_sql',
 *   ...other params
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createSupabaseAdminClient()
    const body = await request.json()
    const { action, ...params } = body

    const builder = new SchemaBuilder(supabase)
    let sql = ''

    switch (action) {
      case 'create_table':
        builder.createTable(params.tableName, (table) => {
          // Parse columns from params
          if (params.columns) {
            params.columns.forEach((col: any) => {
              table.column(col.name, col.type, {
                notNull: col.notNull,
                default: col.default,
                unique: col.unique
              })
            })
          }
          
          if (params.primaryKey) {
            table.primaryKey(params.primaryKey)
          }
          
          if (params.timestamps) {
            table.timestamps()
          }
        })
        sql = builder.toSQL()
        break

      case 'alter_table':
        builder.alterTable(params.tableName, (table) => {
          if (params.addColumn) {
            table.addColumn(
              params.addColumn.name,
              params.addColumn.type,
              {
                notNull: params.addColumn.notNull,
                default: params.addColumn.default
              }
            )
          }
          
          if (params.dropColumn) {
            table.dropColumn(params.dropColumn)
          }
          
          if (params.renameColumn) {
            table.renameColumn(params.renameColumn.oldName, params.renameColumn.newName)
          }
          
          if (params.modifyColumn) {
            table.modifyColumn(params.modifyColumn.name, params.modifyColumn.newType)
          }
          
          if (params.setNotNull) {
            table.setColumnNotNull(params.setNotNull)
          }
          
          if (params.dropNotNull) {
            table.dropColumnNotNull(params.dropNotNull)
          }
        })
        sql = builder.toSQL()
        break

      case 'add_column':
        builder.alterTable(params.tableName, (table) => {
          table.addColumn(params.columnName, params.columnType, {
            notNull: params.notNull,
            default: params.default
          })
        })
        sql = builder.toSQL()
        break

      case 'drop_column':
        builder.alterTable(params.tableName, (table) => {
          table.dropColumn(params.columnName)
        })
        sql = builder.toSQL()
        break

      case 'create_index':
        builder.createIndex(
          params.indexName,
          params.tableName,
          params.columns,
          params.unique
        )
        sql = builder.toSQL()
        break

      case 'drop_index':
        builder.dropIndex(params.indexName)
        sql = builder.toSQL()
        break

      case 'custom_sql':
        sql = params.sql
        break

      default:
        return NextResponse.json(
          { success: false, error: `Unknown action: ${action}` },
          { status: 400 }
        )
    }

    // Execute the SQL
    const result = await executeSQL(sql)

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error,
          sql: sql.substring(0, 500) // Include first 500 chars of SQL for debugging
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: `Successfully executed: ${action}`,
      sql: sql.substring(0, 500) // Include first 500 chars for verification
    })
  } catch (error: any) {
    console.error('Migration error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message,
        stack: error.stack
      },
      { status: 500 }
    )
  }
}

/**
 * GET /api/migrate - Get migration status/help
 */
export async function GET() {
  return NextResponse.json({
    message: 'Database Migration API',
    availableActions: [
      'create_table',
      'alter_table',
      'add_column',
      'drop_column',
      'create_index',
      'drop_index',
      'custom_sql'
    ],
    examples: {
      add_column: {
        action: 'add_column',
        tableName: 'markets',
        columnName: 'new_field',
        columnType: 'VARCHAR(255)',
        notNull: false,
        default: null
      },
      create_table: {
        action: 'create_table',
        tableName: 'new_table',
        columns: [
          { name: 'id', type: 'SERIAL', notNull: true },
          { name: 'name', type: 'VARCHAR(255)', notNull: true }
        ],
        primaryKey: ['id'],
        timestamps: true
      }
    }
  })
}


