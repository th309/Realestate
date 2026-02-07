'use client';

/**
 * Export Button Component
 *
 * Button with dropdown for exporting analytics data to CSV/JSON.
 */

import React, { useState } from 'react';
import { Download, FileSpreadsheet, FileJson, ChevronDown, Loader2, Lock } from 'lucide-react';
import { useEntitlements } from '@/lib/entitlements';
import { PaywallCard } from '@/components/entitlements/PaywallCard';

interface ExportButtonProps {
  data: Record<string, unknown>[];
  columns?: Array<{ key: string; label: string }>;
  filename?: string;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
}

export function ExportButton({
  data,
  columns,
  filename = 'export',
  disabled = false,
  variant = 'secondary',
  size = 'md',
}: ExportButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const { canAccess } = useEntitlements();
  const canExport = canAccess('feature', 'export_csv');

  const sizeClasses = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-3 py-1.5 text-sm',
    lg: 'px-4 py-2 text-base',
  };

  const variantClasses = {
    primary: 'bg-primary text-on-primary hover:bg-primary/90',
    secondary: 'bg-surface-container text-on-surface hover:bg-surface-container-high border border-outline-variant',
    ghost: 'text-on-surface-variant hover:bg-surface-container',
  };

  const handleExport = async (format: 'csv' | 'json') => {
    setIsExporting(true);
    setIsOpen(false);

    try {
      const exportColumns = columns || Object.keys(data[0] || {}).map((k) => ({ key: k, label: k }));

      const response = await fetch('/api/analytics/export/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          columns: exportColumns,
          rows: data,
          format,
          filename: `${filename}.${format}`,
        }),
      });

      if (!response.ok) throw new Error('Export failed');

      // Download the file
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${filename}.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Export failed:', error);
    } finally {
      setIsExporting(false);
    }
  };

  // Client-side export fallback
  const handleClientExport = (format: 'csv' | 'json') => {
    setIsOpen(false);

    let content: string;
    let mimeType: string;

    if (format === 'json') {
      content = JSON.stringify(data, null, 2);
      mimeType = 'application/json';
    } else {
      const headers = columns?.map((c) => c.label) || Object.keys(data[0] || {});
      const keys = columns?.map((c) => c.key) || Object.keys(data[0] || {});

      const rows = [
        headers.join(','),
        ...data.map((row) =>
          keys.map((k) => {
            const val = row[k];
            if (val === null || val === undefined) return '';
            const str = String(val);
            return str.includes(',') || str.includes('"')
              ? `"${str.replace(/"/g, '""')}"`
              : str;
          }).join(',')
        ),
      ];
      content = rows.join('\n');
      mimeType = 'text/csv';
    }

    const blob = new Blob([content], { type: mimeType });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}.${format}`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  return (
    <div className="relative inline-block">
      <button
        onClick={() => canExport ? setIsOpen(!isOpen) : setShowPaywall(true)}
        disabled={disabled || isExporting || data.length === 0}
        className={`flex items-center gap-1.5 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${sizeClasses[size]} ${variantClasses[variant]} ${!canExport ? 'opacity-70' : ''}`}
      >
        {isExporting ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : !canExport ? (
          <Lock className="w-4 h-4" />
        ) : (
          <Download className="w-4 h-4" />
        )}
        Export
        {canExport && <ChevronDown className="w-3 h-3" />}
      </button>

      {isOpen && canExport && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />

          {/* Dropdown */}
          <div className="absolute right-0 mt-1 z-50 bg-surface rounded-lg shadow-lg border border-outline-variant py-1 min-w-[140px]">
            <button
              onClick={() => handleClientExport('csv')}
              className="flex items-center gap-2 w-full px-3 py-2 text-sm text-on-surface hover:bg-surface-container transition-colors"
            >
              <FileSpreadsheet className="w-4 h-4 text-green-600" />
              Export CSV
            </button>
            <button
              onClick={() => handleClientExport('json')}
              className="flex items-center gap-2 w-full px-3 py-2 text-sm text-on-surface hover:bg-surface-container transition-colors"
            >
              <FileJson className="w-4 h-4 text-blue-600" />
              Export JSON
            </button>
          </div>
        </>
      )}

      {/* Paywall modal */}
      {showPaywall && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-scrim/40"
          onClick={() => setShowPaywall(false)}
        >
          <div className="max-w-sm mx-4" onClick={e => e.stopPropagation()}>
            <PaywallCard
              type="feature"
              id="export_csv"
              title="Unlock Data Export"
              description="Export market data to CSV and JSON for your own analysis, presentations, and reports."
            />
          </div>
        </div>
      )}
    </div>
  );
}
