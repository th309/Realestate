# Database Migrations

This directory contains database migration files. Migrations are executed in order and tracked in the `schema_migrations` table.

## Migration File Format

Each migration should export a `Migration` object:

```typescript
import { Migration } from '@/lib/database/migrations'
import { SchemaBuilder } from '@/lib/database/migrations'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'

export const migrationName: Migration = {
  name: '20240101_add_example_column',
  description: 'Add example column to markets table',
  up: async (supabase) => {
    const builder = new SchemaBuilder(supabase)
    builder.alterTable('markets', (table) => {
      table.addColumn('example_field', 'VARCHAR(255)')
    })
    await builder.execute()
  },
  down: async (supabase) => {
    const builder = new SchemaBuilder(supabase)
    builder.alterTable('markets', (table) => {
      table.dropColumn('example_field')
    })
    await builder.execute()
  }
}
```

## Running Migrations

### Via API

```bash
POST /api/migrate/run
{
  "migrations": [migration1, migration2, ...]
}
```

### Via Script

```typescript
import { runPendingMigrations } from '@/lib/database/migration-runner'
import * as migrations from './migrations'

const allMigrations = Object.values(migrations)
await runPendingMigrations(allMigrations)
```

## Migration Naming Convention

Use format: `YYYYMMDD_description`

Examples:
- `20240101_add_example_column`
- `20240115_create_indexes`
- `20240201_add_geography_table`

## Checking Migration Status

```bash
GET /api/migrate/run
```

Returns list of executed migrations.

