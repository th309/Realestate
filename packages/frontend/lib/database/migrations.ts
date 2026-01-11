/**
 * Database Migration System
 * Allows programmatic schema changes without manual SQL
 *
 * Refactored to use modular components from ./migrations/
 */

// Re-export all types and classes for backward compatibility
export type { Migration, ColumnDefinition, ColumnOptions, ForeignKeyDefinition } from './migrations/types'
export { executeSQL, createSQLHelperFunction } from './migrations/executor'
export { TableBuilder } from './migrations/table-builder'
export { AlterTableBuilder } from './migrations/alter-table-builder'
export { SchemaBuilder } from './migrations/schema-builder'

// Import for example migration
import type { Migration } from './migrations/types'
import { SchemaBuilder } from './migrations/schema-builder'

/**
 * Example migration demonstrating the migration system
 */
export const exampleMigration: Migration = {
  name: 'add_example_table',
  description: 'Creates an example table',
  up: async (supabase) => {
    const builder = new SchemaBuilder(supabase)
    builder.createTable('example_table', (table) => {
      table.column('id', 'SERIAL', { notNull: true })
      table.column('name', 'VARCHAR(255)', { notNull: true })
      table.column('email', 'VARCHAR(255)', { unique: true })
      table.primaryKey(['id'])
      table.timestamps()
    })

    const result = await builder.execute()
    if (!result.success) {
      throw new Error(result.error)
    }
  },
  down: async (supabase) => {
    const builder = new SchemaBuilder(supabase)
    builder.dropTable('example_table')
    await builder.execute()
  }
}
