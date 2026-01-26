/**
 * API route for exporting query results
 */

import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { columns, rows, format = 'csv', filename = 'export' } = body;

    if (!columns || !rows) {
      return NextResponse.json(
        { success: false, error: 'columns and rows are required' },
        { status: 400 }
      );
    }

    if (format === 'json') {
      // JSON export
      const filteredData = rows.map((row: Record<string, unknown>) => {
        const filtered: Record<string, unknown> = {};
        for (const col of columns) {
          filtered[col.label || col.key] = row[col.key];
        }
        return filtered;
      });

      return new NextResponse(JSON.stringify(filteredData, null, 2), {
        headers: {
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="${filename}"`,
        },
      });
    }

    // CSV export
    const headers = columns.map((c: { label: string }) => c.label).join(',');
    const keys = columns.map((c: { key: string }) => c.key);

    const csvRows = rows.map((row: Record<string, unknown>) =>
      keys.map((key: string) => {
        const val = row[key];
        if (val === null || val === undefined) return '';
        const str = String(val);
        return str.includes(',') || str.includes('"') || str.includes('\n')
          ? `"${str.replace(/"/g, '""')}"`
          : str;
      }).join(',')
    );

    const csvContent = [headers, ...csvRows].join('\n');

    return new NextResponse(csvContent, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Export failed' },
      { status: 500 }
    );
  }
}
