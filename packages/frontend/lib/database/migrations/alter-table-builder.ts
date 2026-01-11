/**
 * Alter Table Builder for ALTER TABLE statements
 */

import type { ColumnOptions } from './types'

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
