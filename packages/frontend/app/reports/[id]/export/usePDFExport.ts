'use client';

import { useState, useCallback } from 'react';

interface PDFExportOptions {
  title: string;
  filename?: string;
}

interface PDFExportState {
  exporting: boolean;
  error: string | null;
}

export function usePDFExport() {
  const [state, setState] = useState<PDFExportState>({
    exporting: false,
    error: null,
  });

  const exportPDF = useCallback(async (options: PDFExportOptions) => {
    setState({ exporting: true, error: null });

    try {
      // Add print class to body for any global print adjustments
      document.body.classList.add('printing-report');

      // Small delay to let any state changes render
      await new Promise(resolve => setTimeout(resolve, 100));

      // Use browser native print
      window.print();

      setState({ exporting: false, error: null });
    } catch (err) {
      setState({
        exporting: false,
        error: err instanceof Error ? err.message : 'Export failed',
      });
    } finally {
      document.body.classList.remove('printing-report');
    }
  }, []);

  return {
    ...state,
    exportPDF,
  };
}
