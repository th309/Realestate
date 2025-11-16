# Database Schema Migration System

This system allows you to make schema changes to your Supabase database programmatically, without writing SQL manually.

## Setup (One-Time)

1. **Create the SQL helper function in Supabase:**
   - Open Supabase Dashboard → SQL Editor
   - Run the SQL from `scripts/create-sql-helper-function.sql`
   - This creates an `exec_sql` RPC function that allows programmatic SQL execution

## Usage

### Option 1: Using the API Endpoint

Make POST requests to `/api/migrate` with the desired action:

#### Add a Column
```typescript
POST /api/migrate
{
  "action": "add_column",
  "tableName": "markets",
  "columnName": "new_field",
  "columnType": "VARCHAR(255)",
  "notNull": false,
  "default": null
}
```

#### Create a Table
```typescript
POST /api/migrate
{
  "action": "create_table",
  "tableName": "my_new_table",
  "columns": [
    { "name": "id", "type": "SERIAL", "notNull": true },
    { "name": "name", "type": "VARCHAR(255)", "notNull": true },
    { "name": "email", "type": "VARCHAR(255)", "unique": true }
  ],
  "primaryKey": ["id"],
  "timestamps": true
}
```

#### Drop a Column
```typescript
POST /api/migrate
{
  "action": "drop_column",
  "tableName": "markets",
  "columnName": "old_field"
}
```

#### Create an Index
```typescript
POST /api/migrate
{
  "action": "create_index",
  "indexName": "idx_markets_region",
  "tableName": "markets",
  "columns": ["region_id", "region_type"],
  "unique": false
}
```

#### Custom SQL
```typescript
POST /api/migrate
{
  "action": "custom_sql",
  "sql": "ALTER TABLE markets ADD COLUMN test_field INTEGER;"
}
```

### Option 2: Using Helper Functions in Code

```typescript
import { addColumn, dropColumn, createIndex, createTable } from '@/lib/database/schema-helpers'

// Add a column
await addColumn('markets', 'new_field', 'VARCHAR(255)', {
  notNull: false,
  default: 'default_value'
})

// Drop a column
await dropColumn('markets', 'old_field')

// Create an index
await createIndex('idx_markets_region', 'markets', ['region_id'], false)

// Create a table
await createTable('my_table', {
  columns: [
    { name: 'id', type: 'SERIAL', notNull: true },
    { name: 'name', type: 'VARCHAR(255)', notNull: true }
  ],
  primaryKey: ['id'],
  timestamps: true
})
```

### Option 3: Using SchemaBuilder Directly

```typescript
import { SchemaBuilder } from '@/lib/database/migrations'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'

const supabase = createSupabaseAdminClient()
const builder = new SchemaBuilder(supabase)

// Build complex schema changes
builder
  .alterTable('markets', (table) => {
    table.addColumn('new_field', 'VARCHAR(255)')
    table.modifyColumn('old_field', 'TEXT')
  })
  .createIndex('idx_markets_new', 'markets', ['new_field'])

// Execute all changes
const result = await builder.execute()
if (!result.success) {
  console.error('Migration failed:', result.error)
}
```

## Available Actions

- `add_column` - Add a new column to a table
- `drop_column` - Remove a column from a table
- `rename_column` - Rename a column
- `modify_column` - Change column type
- `create_table` - Create a new table
- `alter_table` - Make multiple changes to a table
- `create_index` - Create an index
- `drop_index` - Drop an index
- `custom_sql` - Execute raw SQL (use with caution)

## Supported Column Types

- `SERIAL`, `BIGSERIAL` - Auto-incrementing integers
- `INTEGER`, `BIGINT` - Integers
- `VARCHAR(n)`, `TEXT` - Strings
- `NUMERIC(p,s)`, `DECIMAL(p,s)` - Decimal numbers
- `BOOLEAN` - Boolean values
- `DATE`, `TIMESTAMP`, `TIMESTAMPTZ` - Dates and times
- `JSONB`, `JSON` - JSON data
- `GEOMETRY` - PostGIS geometry types

## Examples

### Add a JSONB column for metadata
```typescript
await addColumn('markets', 'metadata', 'JSONB', {
  default: '{}'
})
```

### Add a timestamp column with default
```typescript
await addColumn('markets', 'last_updated', 'TIMESTAMPTZ', {
  default: 'NOW()',
  notNull: true
})
```

### Create a table with foreign key
```typescript
const builder = new SchemaBuilder(supabase)
builder.createTable('user_preferences', (table) => {
  table.column('id', 'SERIAL', { notNull: true })
  table.column('user_id', 'UUID', { notNull: true })
  table.column('preference_key', 'VARCHAR(100)', { notNull: true })
  table.column('preference_value', 'TEXT')
  table.primaryKey(['id'])
  table.foreignKey(['user_id'], 'auth.users(id)', 'CASCADE')
  table.timestamps()
})
await builder.execute()
```

## Security Notes

- The `exec_sql` function uses `SECURITY DEFINER`, meaning it runs with the privileges of the function owner
- Only use this with the service role key in server-side code
- Never expose the migration API to client-side code
- Always validate inputs before executing migrations

## Troubleshooting

If you get "function exec_sql does not exist":
1. Make sure you've run `scripts/create-sql-helper-function.sql` in Supabase SQL Editor
2. Check that the function was created in the `public` schema

If migrations fail:
- Check the error message for specific SQL errors
- Verify table/column names are correct
- Ensure you have the necessary permissions


