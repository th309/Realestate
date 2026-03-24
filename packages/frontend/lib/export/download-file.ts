/**
 * Shared download utilities for CSV/JSON export.
 * Extracted from components/analytics-assistant/ExportButton.tsx pattern.
 */

/**
 * Trigger a browser file download from in-memory data.
 */
export function downloadBlob(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
}

/**
 * Convert an array of objects to CSV string.
 * columns: ordered list of { key, label } — key is the object property, label is the header.
 */
export function toCsv(
  data: Record<string, unknown>[],
  columns: Array<{ key: string; label: string }>,
): string {
  const headers = columns.map((c) => escapeCsvValue(c.label));
  const rows = data.map((row) =>
    columns
      .map((c) => {
        const val = row[c.key];
        if (val === null || val === undefined) return '';
        const str = String(val);
        return escapeCsvValue(str);
      })
      .join(','),
  );
  return [headers.join(','), ...rows].join('\n');
}

function escapeCsvValue(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * One-call CSV download: data → CSV string → browser download.
 */
export function downloadCsv(
  data: Record<string, unknown>[],
  columns: Array<{ key: string; label: string }>,
  filename: string,
): void {
  const csv = toCsv(data, columns);
  downloadBlob(csv, filename.endsWith('.csv') ? filename : `${filename}.csv`, 'text/csv');
}

/**
 * One-call JSON download.
 */
export function downloadJson(
  data: Record<string, unknown>[],
  filename: string,
): void {
  const json = JSON.stringify(data, null, 2);
  downloadBlob(json, filename.endsWith('.json') ? filename : `${filename}.json`, 'application/json');
}
