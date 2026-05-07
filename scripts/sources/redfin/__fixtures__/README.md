# Redfin fixtures

This directory holds TSV fixtures used by the Redfin importer tests. Each
fixture is either **captured-from-source** (real Redfin output saved verbatim)
or **synthetic** (hand-authored to match the documented column shape).

| File                          | Type          | Notes                                                                                                                                                                                                                                             |
| ----------------------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `redfin-migration-sample.tsv` | **synthetic** | Redfin's S3 paths for the migration dataset return 403, and the live data lives behind a Tableau dashboard with no flat-file export. The column header here mirrors what `parseRedfinMigrationTsv` expects, but the values were authored by hand. |

## Sourcing a real fixture

When a real URL is sourced (via econdata@redfin.com or otherwise):

1. Save the captured TSV alongside this file as `redfin-migration-real-sample.tsv`.
2. Re-run `redfin-migration-download.spec.ts` against the real fixture and adjust
   the parser if column names have drifted.
3. Keep the synthetic fixture in place so column-shape tests stay deterministic
   even when the live URL changes.

## Activation knob

The importer reads `REDFIN_MIGRATION_S3_URL` (see `redfin-config.ts`). Until a
real URL is sourced, the importer points at a placeholder and only the parser
is exercised against the synthetic fixture above.
