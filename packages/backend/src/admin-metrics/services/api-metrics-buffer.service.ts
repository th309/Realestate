import { Injectable, Inject, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from '../../supabase/supabase.service';
import { ApiTimingEntry } from '../admin-metrics.types';

@Injectable()
export class ApiMetricsBufferService {
  private readonly logger = new Logger(ApiMetricsBufferService.name);
  private buffer: ApiTimingEntry[] = [];

  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
  ) {}

  record(entry: ApiTimingEntry): void {
    this.buffer.push(entry);
  }

  @Cron('*/1 * * * *')
  async flush(): Promise<void> {
    if (this.buffer.length === 0) return;

    // Atomically swap the buffer so new entries go to a fresh array
    // while we process the captured snapshot
    const entries = this.buffer;
    this.buffer = [];

    try {
      const rows = this.aggregateEntries(entries);

      if (rows.length === 0) return;

      const { error } = await this.supabase
        .from('admin_api_metrics')
        .insert(rows);

      if (error) {
        this.logger.error('Failed to flush API metrics to Supabase', error);
      } else {
        this.logger.debug(
          `Flushed ${rows.length} endpoint aggregates from ${entries.length} requests`,
        );
      }
    } catch (err) {
      this.logger.error('Unexpected error during API metrics flush', err);
    }
  }

  private aggregateEntries(
    entries: ApiTimingEntry[],
  ): Record<string, unknown>[] {
    const grouped = new Map<string, ApiTimingEntry[]>();

    for (const entry of entries) {
      const normalizedEndpoint = this.normalizeEndpoint(entry.endpoint);
      const existing = grouped.get(normalizedEndpoint);
      if (existing) {
        existing.push(entry);
      } else {
        grouped.set(normalizedEndpoint, [entry]);
      }
    }

    const windowTimestamp = new Date().toISOString();
    const rows: Record<string, unknown>[] = [];

    for (const [endpoint, group] of grouped.entries()) {
      const durations = group.map((e) => e.duration_ms).sort((a, b) => a - b);

      const errorCount = group.filter((e) => e.status_code >= 400).length;

      rows.push({
        timestamp: windowTimestamp,
        endpoint,
        p50_ms: this.percentile(durations, 0.5),
        p95_ms: this.percentile(durations, 0.95),
        p99_ms: this.percentile(durations, 0.99),
        request_count: group.length,
        error_count: errorCount,
        error_rate: errorCount / group.length,
      });
    }

    return rows;
  }

  private normalizeEndpoint(path: string): string {
    // Strip query string
    let normalized = path.split('?')[0];

    // Replace UUIDs (8-4-4-4-12 hex format)
    normalized = normalized.replace(
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
      ':id',
    );

    // Replace 5+ digit numbers (e.g. FIPS codes, CBSA codes, ZIP codes)
    normalized = normalized.replace(/\d{5,}/g, ':id');

    // Replace any remaining standalone numbers in path segments
    normalized = normalized.replace(/\/\d+/g, '/:id');

    return normalized;
  }

  private percentile(sortedValues: number[], p: number): number {
    if (sortedValues.length === 0) return 0;
    const index = Math.max(0, Math.ceil(p * sortedValues.length) - 1);
    return sortedValues[index];
  }
}
