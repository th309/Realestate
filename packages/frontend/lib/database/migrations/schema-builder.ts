/**
 * Schema Builder for creating tables, columns, indexes, etc.
 */

import { executeSQL } from './executor'
import { TableBuilder } from './table-builder'
import { AlterTableBuilder } from './alter-table-builder'

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
