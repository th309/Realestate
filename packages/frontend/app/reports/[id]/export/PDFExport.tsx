'use client';

import React from 'react';
import { Download, Loader2 } from 'lucide-react';
import { PDFCoverPage, PDFTableOfContents, PDFPrintFooter } from './PDFLayout';
import { usePDFExport } from './usePDFExport';

interface PDFExportProps {
  title: string;
  marketName: string;
  score?: number | null;
  scoreLabel?: string;
  grade?: string | null;
  generatedDate: string;
  dataAsOfDate: string;
  aiModel?: string | null;
  sections: Array<{ id: string; name: string }>;
  templateType?: string;
}

export function PDFExportButton({
  title,
  marketName,
  score,
  scoreLabel,
  grade,
  generatedDate,
  dataAsOfDate,
  aiModel,
  sections,
}: PDFExportProps): React.ReactElement {
  const { exporting, exportPDF, error } = usePDFExport();

  return (
    <>
      {/* Print-only elements rendered in the DOM but hidden on screen */}
      <PDFCoverPage
        title={title}
        marketName={marketName}
        score={score}
        scoreLabel={scoreLabel}
        grade={grade}
        generatedDate={generatedDate}
        dataAsOfDate={dataAsOfDate}
        aiModel={aiModel}
      />
      <PDFTableOfContents sections={sections} />
      <PDFPrintFooter />

      {/* Export button - replaces the existing Download button */}
      <button
        onClick={() => exportPDF({ title, filename: `${title.replace(/\s+/g, '-').toLowerCase()}.pdf` })}
        disabled={exporting}
        className="report-btn-primary"
        title={error || 'Download PDF'}
      >
        {exporting ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Download className="w-4 h-4" />
        )}
        <span className="hidden sm:inline">
          {exporting ? 'Preparing...' : 'Download'}
        </span>
      </button>
    </>
  );
}

export default PDFExportButton;
