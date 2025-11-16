/**
 * Database Migration System
 * Allows programmatic schema changes without manual SQL
 */

import { createSupabaseAdminClient } from '@/lib/supabase/admin'

export interface Migration {
  name: string
  description: string
  up: (supabase: any) => Promise<void>
  down?: (supabase: any) => Promise<void>
}

/**
 * Execute raw SQL using Supabase admin client
 * Uses RPC function exec_sql if available, otherwise falls back to direct HTTP
 */
export async function executeSQL(sql: string): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = createSupabaseAdminClient()
    
    // Split SQL into individual statements
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'))
    
    for (const statement of statements) {
      if (statement.length === 0) continue
      
      // Try to execute via RPC function first
      const { error: rpcError } = await supabase.rpc('exec_sql', { query: statement })
      
      if (rpcError) {
        // If RPC doesn't exist or fails, try direct HTTP to Supabase REST API
        // This requires the service role key
        const { getEnv } = await import('@/lib/env')
        const { supabaseUrl, supabaseServiceKey } = getEnv()
        
        if (!supabaseUrl || !supabaseServiceKey) {
          throw new Error('Missing Supabase credentials. Cannot execute SQL.')
        }
        
        // Use Supabase REST API to execute SQL via PostgREST
        // Note: This requires the exec_sql function to exist
        // If it doesn't, we'll need to create it first via Supabase dashboard
        const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': supabaseServiceKey,
            'Authorization': `Bearer ${supabaseServiceKey}`
          },
          body: JSON.stringify({ query: statement })
        })
        
        if (!response.ok) {
          const errorText = await response.text()
          throw new Error(`SQL execution failed: ${errorText}\nStatement: ${statement.substring(0, 100)}...`)
        }
      }
    }
    
    return { success: true }
  } catch (error: any) {
    return {
      success: false,
      error: error.message
    }
  }
}

/**
 * Create a helper RPC function in Supabase to execute SQL
 * This needs to be run once in Supabase SQL Editor:
 * 
 * CREATE OR REPLACE FUNCTION exec_sql(query text)
 * RETURNS void
 * LANGUAGE plpgsql
 * SECURITY DEFINER
 * AS $$
 * BEGIN
 *   EXECUTE query;
 * END;
 * $$;
 */
export async function createSQLHelperFunction(): Promise<{ success: boolean; error?: string }> {
  const sql = `
    CREATE OR REPLACE FUNCTION exec_sql(query text)
    RETURNS void
    LANGUAGE plpgsql
    SECURITY DEFINER
    AS $$
    BEGIN
      EXECUTE query;
    END;
    $$;
  `
  
  return executeSQL(sql)
}

/**
 * Schema builder for creating tables, columns, indexes, etc.
 */
export class SchemaBuilder {
  private supabase: any
  private changes: string[] = []

  constructor(supabase: any) {
    this.supabase = supabase
  }

  /**
   * Create a new table
   */
  createTable(tableName: string, callback: (table: TableBuilder) => void): this {
    const table = new TableBuilder(tableName)
    callback(table)
    this.changes.push(table.toSQL())
    return this
  }

  /**
   * Alter an existing table
   */
  alterTable(tableName: string, callback: (table: AlterTableBuilder) => void): this {
    const table = new AlterTableBuilder(tableName)
    callback(table)
    this.changes.push(...table.toSQL())
    return this
  }

  /**
   * Drop a table
   */
  dropTable(tableName: string, ifExists: boolean = true): this {
    const sql = `DROP TABLE ${ifExists ? 'IF EXISTS ' : ''}${this.quoteIdentifier(tableName)} CASCADE;`
    this.changes.push(sql)
    return this
  }

  /**
   * Create an index
   */
  createIndex(indexName: string, tableName: string, columns: string[], unique: boolean = false): this {
    const uniqueClause = unique ? 'UNIQUE ' : ''
    const columnsList = columns.map(col => this.quoteIdentifier(col)).join(', ')
    const sql = `CREATE ${uniqueClause}INDEX IF NOT EXISTS ${this.quoteIdentifier(indexName)} ON ${this.quoteIdentifier(tableName)} (${columnsList});`
    this.changes.push(sql)
    return this
  }

  /**
   * Drop an index
   */
  dropIndex(indexName: string, ifExists: boolean = true): this {
    const sql = `DROP INDEX ${ifExists ? 'IF EXISTS ' : ''}${this.quoteIdentifier(indexName)};`
    this.changes.push(sql)
    return this
  }

  /**
   * Get all SQL changes
   */
  toSQL(): string {
    return this.changes.join('\n\n')
  }

  /**
   * Execute all changes
   */
  async execute(): Promise<{ success: boolean; error?: string }> {
    return executeSQL(this.toSQL())
  }

  private quoteIdentifier(name: string): string {
    return `"${name}"`
  }
}

/**
 * Table builder for CREATE TABLE statements
 */
export class TableBuilder {
  private tableName: string
  private columns: ColumnDefinition[] = []
  private primaryKey?: string[]
  private foreignKeys: ForeignKeyDefinition[] = []

  constructor(tableName: string) {
    this.tableName = tableName
  }

  /**
   * Add a column
   */
  column(name: string, type: string, options?: ColumnOptions): this {
    this.columns.push({ name, type, ...options })
    return this
  }

  /**
   * Set primary key
   */
  primaryKey(columns: string[]): this {
    this.primaryKey = columns
    return this
  }

  /**
   * Add foreign key
   */
  foreignKey(columns: string[], references: string, onDelete?: string, onUpdate?: string): this {
    this.foreignKeys.push({ columns, references, onDelete, onUpdate })
    return this
  }

  /**
   * Add timestamps (created_at, updated_at)
   */
  timestamps(): this {
    this.column('created_at', 'TIMESTAMPTZ', { default: 'NOW()', notNull: true })
    this.column('updated_at', 'TIMESTAMPTZ', { default: 'NOW()', notNull: true })
    return this
  }

  /**
   * Generate SQL
   */
  toSQL(): string {
    const parts: string[] = []
    parts.push(`CREATE TABLE IF NOT EXISTS "${this.tableName}" (`)
    
    // Columns
    const columnDefs = this.columns.map(col => {
      let def = `  "${col.name}" ${col.type}`
      
      if (col.notNull) def += ' NOT NULL'
      if (col.default !== undefined) {
        if (typeof col.default === 'string' && !col.default.match(/^[A-Z_]+\(\)$/)) {
          def += ` DEFAULT '${col.default}'`
        } else {
          def += ` DEFAULT ${col.default}`
        }
      }
      if (col.unique) def += ' UNIQUE'
      
      return def
    })
    
    // Primary key
    if (this.primaryKey && this.primaryKey.length > 0) {
      const pkCols = this.primaryKey.map(c => `"${c}"`).join(', ')
      columnDefs.push(`  PRIMARY KEY (${pkCols})`)
    }
    
    parts.push(columnDefs.join(',\n'))
    parts.push(');')
    
    // Foreign keys
    for (const fk of this.foreignKeys) {
      const cols = fk.columns.map(c => `"${c}"`).join(', ')
      let fkSql = `ALTER TABLE "${this.tableName}" ADD CONSTRAINT "${this.tableName}_${fk.columns[0]}_fkey" FOREIGN KEY (${cols}) REFERENCES ${fk.references}`
      if (fk.onDelete) fkSql += ` ON DELETE ${fk.onDelete}`
      if (fk.onUpdate) fkSql += ` ON UPDATE ${fk.onUpdate}`
      fkSql += ';'
      parts.push(fkSql)
    }
    
    return parts.join('\n')
  }
}

/**
 * Alter table builder for ALTER TABLE statements
 */
export class AlterTableBuilder {
  private tableName: string
  private changes: string[] = []

  constructor(tableName: string) {
    this.tableName = tableName
  }

  /**
   * Add a column
   */
  addColumn(name: string, type: string, options?: ColumnOptions): this {
    let sql = `ALTER TABLE "${this.tableName}" ADD COLUMN "${name}" ${type}`
    if (options?.notNull) sql += ' NOT NULL'
    if (options?.default !== undefined) {
      if (typeof options.default === 'string' && !options.default.match(/^[A-Z_]+\(\)$/)) {
        sql += ` DEFAULT '${options.default}'`
      } else {
        sql += ` DEFAULT ${options.default}`
      }
    }
    sql += ';'
    this.changes.push(sql)
    return this
  }

  /**
   * Drop a column
   */
  dropColumn(name: string, ifExists: boolean = true): this {
    const sql = `ALTER TABLE "${this.tableName}" DROP COLUMN ${ifExists ? 'IF EXISTS ' : ''}"${name}";`
    this.changes.push(sql)
    return this
  }

  /**
   * Rename a column
   */
  renameColumn(oldName: string, newName: string): this {
    const sql = `ALTER TABLE "${this.tableName}" RENAME COLUMN "${oldName}" TO "${newName}";`
    this.changes.push(sql)
    return this
  }

  /**
   * Modify column type
   */
  modifyColumn(name: string, newType: string): this {
    const sql = `ALTER TABLE "${this.tableName}" ALTER COLUMN "${name}" TYPE ${newType};`
    this.changes.push(sql)
    return this
  }

  /**
   * Set column default
   */
  setColumnDefault(name: string, defaultValue: string | number): this {
    const def = typeof defaultValue === 'string' ? `'${defaultValue}'` : defaultValue.toString()
    const sql = `ALTER TABLE "${this.tableName}" ALTER COLUMN "${name}" SET DEFAULT ${def};`
    this.changes.push(sql)
    return this
  }

  /**
   * Drop column default
   */
  dropColumnDefault(name: string): this {
    const sql = `ALTER TABLE "${this.tableName}" ALTER COLUMN "${name}" DROP DEFAULT;`
    this.changes.push(sql)
    return this
  }

  /**
   * Set column NOT NULL
   */
  setColumnNotNull(name: string): this {
    const sql = `ALTER TABLE "${this.tableName}" ALTER COLUMN "${name}" SET NOT NULL;`
    this.changes.push(sql)
    return this
  }

  /**
   * Drop column NOT NULL
   */
  dropColumnNotNull(name: string): this {
    const sql = `ALTER TABLE "${this.tableName}" ALTER COLUMN "${name}" DROP NOT NULL;`
    this.changes.push(sql)
    return this
  }

  /**
   * Add foreign key
   */
  addForeignKey(columns: string[], references: string, onDelete?: string): this {
    const cols = columns.map(c => `"${c}"`).join(', ')
    let sql = `ALTER TABLE "${this.tableName}" ADD CONSTRAINT "${this.tableName}_${columns[0]}_fkey" FOREIGN KEY (${cols}) REFERENCES ${references}`
    if (onDelete) sql += ` ON DELETE ${onDelete}`
    sql += ';'
    this.changes.push(sql)
    return this
  }

  /**
   * Drop foreign key
   */
  dropForeignKey(constraintName: string): this {
    const sql = `ALTER TABLE "${this.tableName}" DROP CONSTRAINT IF EXISTS "${constraintName}";`
    this.changes.push(sql)
    return this
  }

  /**
   * Get all SQL changes
   */
  toSQL(): string[] {
    return this.changes
  }
}

interface ColumnDefinition {
  name: string
  type: string
  notNull?: boolean
  default?: string | number
  unique?: boolean
}

interface ColumnOptions {
  notNull?: boolean
  default?: string | number
  unique?: boolean
}

interface ForeignKeyDefinition {
  columns: string[]
  references: string
  onDelete?: string
  onUpdate?: string
}

/**
 * Example migration
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

