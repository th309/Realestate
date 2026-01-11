/**
 * Data Ingestion Progress Logger
 * 
 * Provides utilities for logging data ingestion progress to the database.
 * This enables real-time monitoring of import jobs via the status script.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

export interface IngestionLogEntry {
    id?: string
    source: string
    table_name: string
    metric_name?: string
    dataset_id?: string
    records_processed: number
    records_success: number
    records_error: number
    status: 'running' | 'success' | 'partial' | 'failed'
    error_message?: string
    started_at?: string
    completed_at?: string
    duration_ms?: number
}

/**
 * Create a new ingestion log entry when starting an import
 */
export async function startIngestionLog(
    supabase: SupabaseClient,
    source: string,
    tableName: string,
    metricName?: string,
    datasetId?: string
): Promise<string | null> {
    try {
        const { data, error } = await supabase
            .from('data_ingestion_log')
            .insert({
                source,
                table_name: tableName,
                metric_name: metricName,
                dataset_id: datasetId,
                status: 'running',
                records_processed: 0,
                records_success: 0,
                records_error: 0,
                started_at: new Date().toISOString()
            })
            .select('id')
            .single()

        if (error) {
            console.warn('⚠️ Could not create ingestion log:', error.message)
            return null
        }

        console.log(`📝 Started ingestion log: ${data.id}`)
        return data.id
    } catch (e: any) {
        console.warn('⚠️ Error starting ingestion log:', e.message)
        return null
    }
}

/**
 * Update progress during an import (call periodically)
 */
export async function updateIngestionProgress(
    supabase: SupabaseClient,
    logId: string,
    recordsProcessed: number,
    recordsSuccess: number,
    recordsError: number
): Promise<void> {
    if (!logId) return

    try {
        await supabase
            .from('data_ingestion_log')
            .update({
                records_processed: recordsProcessed,
                records_success: recordsSuccess,
                records_error: recordsError
            })
            .eq('id', logId)
    } catch (e: any) {
        // Silently fail - don't want to interrupt the import
    }
}

/**
 * Complete an ingestion log entry
 */
export async function completeIngestionLog(
    supabase: SupabaseClient,
    logId: string | null,
    recordsProcessed: number,
    recordsSuccess: number,
    recordsError: number,
    startTime: number,
    errorMessage?: string
): Promise<void> {
    if (!logId) return

    const durationMs = Date.now() - startTime
    const status = recordsError > 0
        ? (recordsSuccess > 0 ? 'partial' : 'failed')
        : 'success'

    try {
        await supabase
            .from('data_ingestion_log')
            .update({
                status,
                records_processed: recordsProcessed,
                records_success: recordsSuccess,
                records_error: recordsError,
                completed_at: new Date().toISOString(),
                duration_ms: durationMs,
                error_message: errorMessage
            })
            .eq('id', logId)

        const statusIcon = status === 'success' ? '✅' : status === 'partial' ? '⚠️' : '❌'
        console.log(`${statusIcon} Ingestion log completed: ${status} (${durationMs}ms)`)
    } catch (e: any) {
        console.warn('⚠️ Error completing ingestion log:', e.message)
    }
}

/**
 * Progress callback type for import functions
 */
export type ProgressCallback = (
    message: string,
    progress?: { current: number; total: number; percent: number }
) => void

/**
 * Create a progress callback that logs to both console and database
 */
export function createProgressLogger(
    supabase: SupabaseClient,
    logId: string | null,
    updateInterval: number = 10 // Update DB every N progress calls
): {
    callback: ProgressCallback
    getStats: () => { processed: number; success: number; errors: number }
    updateStats: (processed: number, success: number, errors: number) => void
} {
    let callCount = 0
    let stats = { processed: 0, success: 0, errors: 0 }

    const callback: ProgressCallback = (message, progress) => {
        console.log(message)
        callCount++

        // Update database periodically
        if (logId && callCount % updateInterval === 0 && progress) {
            updateIngestionProgress(supabase, logId, stats.processed, stats.success, stats.errors)
        }
    }

    return {
        callback,
        getStats: () => stats,
        updateStats: (processed: number, success: number, errors: number) => {
            stats = { processed, success, errors }
        }
    }
}
