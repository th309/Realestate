# Audit of Frontend Data Ingestion Usage

This document lists all frontend components and API routes that depend on the `lib/data-ingestion` library. These dependencies must be migrated to the backend during the Architecture Cleanup.

## API Routes

| Path | Imports From | User Type | Priority | Notes |
|------|--------------|-----------|----------|-------|
| `app/api/import-census/route.ts` | `lib/data-ingestion/sources/census` | Admin | High | Triggers Census data import |
| `app/api/import-fred/route.ts` | `lib/data-ingestion/sources/fred` | Admin | High | Triggers FRED data import |
| `app/api/import-zillow/route.ts` | `lib/data-ingestion/sources/zillow-v2` | Admin | High | Triggers Zillow data import |
| `app/api/import-redfin/route.ts` | `lib/data-ingestion/sources/redfin` | Admin | High | Triggers Redfin data import (supports file upload & auto-import) |
| `app/api/test-zillow/route.ts` | `lib/data-ingestion/sources/zillow-v2` | Admin | Medium | Test endpoint for Zillow |
| `app/api/test-zillow-simple/route.ts` | `lib/data-ingestion/sources/zillow-v2` | Admin | Low | Simple test endpoint for Zillow |
| `app/api/analyze-zillow/route.ts` | N/A (likely indirect) | Admin | Low | Needs verification |

## Library Files

| Path | Description | Action |
|------|-------------|--------|
| `lib/data-ingestion/sources/*` | Source-specific ingestion logic | Move to Backend |
| `lib/data-ingestion/utils/*` | Utility functions | Move to Backend |
| `lib/data-ingestion/validators/*` | Validation logic | Move to Backend |
| `lib/data-ingestion/progress-logger.ts` | Logging utility | Adapt for NestJS Logger |

## Strategy

1.  **Duplicate Types:** Copy necessary types to the backend immediately to unblock migration.
2.  **Migrate Logic:** Move the core logic from `lib/data-ingestion` to the NestJS backend `packages/backend/src/data-ingestion`.
3.  **Update API Routes:** Refactor the Next.js API routes listed above to act as proxies to the new NestJS endpoints, or replace them entirely with direct calls from the frontend components.
