/**
 * Table Builder for CREATE TABLE statements
 */

import type { ColumnDefinition, ColumnOptions, ForeignKeyDefinition } from './types'

export class TableBuilder {
  private tableName: string
  private columns: ColumnDefinition[] = []
  private _primaryKey?: string[]
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
    this._primaryKey = columns
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
    if (this._primaryKey && this._primaryKey.length > 0) {
      const pkCols = this._primaryKey.map(c => `"${c}"`).join(', ')
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
