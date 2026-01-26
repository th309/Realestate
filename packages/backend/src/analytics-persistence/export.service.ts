/**
 * Export Service
 *
 * Handles CSV export of analytics data.
 */

import { Injectable, Logger } from '@nestjs/common';

export interface ExportOptions {
  format: 'csv' | 'json';
  columns?: string[];
  includeHeaders?: boolean;
  dateFormat?: string;
}

export interface ExportResult {
  data: string;
  filename: string;
  mimeType: string;
  rowCount: number;
}

@Injectable()
export class ExportService {
  private readonly logger = new Logger(ExportService.name);

  /**
   * Export data to CSV format
   */
  exportToCsv(
    data: Record<string, unknown>[],
    options: ExportOptions = { format: 'csv' },
  ): ExportResult {
    if (!data || data.length === 0) {
      return {
        data: '',
        filename: 'export.csv',
        mimeType: 'text/csv',
        rowCount: 0,
      };
    }

    // Determine columns
    const columns = options.columns || Object.keys(data[0]);
    
    // Build CSV
    const rows: string[] = [];

    // Header row
    if (options.includeHeaders !== false) {
      rows.push(columns.map(this.formatHeader).join(','));
    }

    // Data rows
    for (const row of data) {
      const values = columns.map((col) => this.formatCsvValue(row[col]));
      rows.push(values.join(','));
    }

    const csvContent = rows.join('\n');

    return {
      data: csvContent,
      filename: `export_${Date.now()}.csv`,
      mimeType: 'text/csv',
      rowCount: data.length,
    };
  }

  /**
   * Export data to JSON format
   */
  exportToJson(
    data: Record<string, unknown>[],
    options: ExportOptions = { format: 'json' },
  ): ExportResult {
    const columns = options.columns;
    
    // Filter columns if specified
    const exportData = columns
      ? data.map((row) => {
          const filtered: Record<string, unknown> = {};
          for (const col of columns) {
            filtered[col] = row[col];
          }
          return filtered;
        })
      : data;

    return {
      data: JSON.stringify(exportData, null, 2),
      filename: `export_${Date.now()}.json`,
      mimeType: 'application/json',
      rowCount: data.length,
    };
  }

  /**
   * Export query results
   */
  exportQueryResults(
    queryResult: {
      columns: Array<{ key: string; label: string }>;
      rows: Record<string, unknown>[];
    },
    options: ExportOptions,
  ): ExportResult {
    const columnKeys = queryResult.columns.map((c) => c.key);
    const columnLabels = queryResult.columns.map((c) => c.label);

    if (options.format === 'json') {
      return this.exportToJson(queryResult.rows, {
        ...options,
        columns: columnKeys,
      });
    }

    // CSV with proper headers
    const rows: string[] = [];

    // Use labels for headers
    if (options.includeHeaders !== false) {
      rows.push(columnLabels.map((l) => this.escapeCsvValue(l)).join(','));
    }

    // Data rows
    for (const row of queryResult.rows) {
      const values = columnKeys.map((key) => this.formatCsvValue(row[key]));
      rows.push(values.join(','));
    }

    return {
      data: rows.join('\n'),
      filename: `query_results_${Date.now()}.csv`,
      mimeType: 'text/csv',
      rowCount: queryResult.rows.length,
    };
  }

  /**
   * Export comparison data
   */
  exportComparison(
    geographies: Array<{
      name: string;
      type: string;
      metrics: Record<string, number | string>;
    }>,
    metricLabels: Record<string, string>,
    options: ExportOptions,
  ): ExportResult {
    const metrics = Object.keys(geographies[0]?.metrics || {});
    
    // Transform to flat rows
    const rows: Record<string, unknown>[] = geographies.map((geo) => ({
      Geography: geo.name,
      Type: geo.type,
      ...Object.fromEntries(
        metrics.map((m) => [metricLabels[m] || m, geo.metrics[m]])
      ),
    }));

    if (options.format === 'json') {
      return this.exportToJson(rows, options);
    }

    return this.exportToCsv(rows, options);
  }

  /**
   * Export time series data
   */
  exportTimeSeries(
    series: Array<{
      name: string;
      data: Array<{ date: string; value: number }>;
    }>,
    options: ExportOptions,
  ): ExportResult {
    // Pivot to date-based rows
    const dateMap = new Map<string, Record<string, unknown>>();

    for (const s of series) {
      for (const point of s.data) {
        if (!dateMap.has(point.date)) {
          dateMap.set(point.date, { Date: point.date });
        }
        dateMap.get(point.date)![s.name] = point.value;
      }
    }

    const rows = Array.from(dateMap.values()).sort((a, b) =>
      String(a.Date).localeCompare(String(b.Date))
    );

    if (options.format === 'json') {
      return this.exportToJson(rows, options);
    }

    return this.exportToCsv(rows, options);
  }

  /**
   * Format header (snake_case to Title Case)
   */
  private formatHeader(key: string): string {
    return key
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  /**
   * Format value for CSV
   */
  private formatCsvValue(value: unknown): string {
    if (value === null || value === undefined) {
      return '';
    }

    if (typeof value === 'number') {
      return String(value);
    }

    if (typeof value === 'boolean') {
      return value ? 'Yes' : 'No';
    }

    if (value instanceof Date) {
      return value.toISOString().split('T')[0];
    }

    if (typeof value === 'object') {
      return this.escapeCsvValue(JSON.stringify(value));
    }

    return this.escapeCsvValue(String(value));
  }

  /**
   * Escape CSV value (handle quotes and commas)
   */
  private escapeCsvValue(value: string): string {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }
}
