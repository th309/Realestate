/**
 * Migration System Type Definitions
 */

export interface Migration {
  name: string
  description: string
  up: (supabase: any) => Promise<void>
  down?: (supabase: any) => Promise<void>
}

export interface ColumnDefinition {
  name: string
  type: string
  notNull?: boolean
  default?: string | number
  unique?: boolean
}

export interface ColumnOptions {
  notNull?: boolean
  default?: string | number
  unique?: boolean
}

export interface ForeignKeyDefinition {
  columns: string[]
  references: string
  onDelete?: string
  onUpdate?: string
}
