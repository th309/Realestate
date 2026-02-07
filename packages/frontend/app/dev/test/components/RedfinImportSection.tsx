'use client';

import type { RedfinSectionProps, ImportProgress, UploadedFile } from './types';
import { useTestApi } from './hooks/useTestApi';

export function RedfinImportSection({
  loading,
  setLoading,
  setResult,
  uploadProgress,
  setUploadProgress,
  importProgress,
  setImportProgress,
  uploadedFiles,
  setUploadedFiles
}: RedfinSectionProps) {
  const api = useTestApi({ setLoading, setResult });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setImportProgress(null);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      const metricNameInput = document.getElementById('redfin-metric-name') as HTMLInputElement;
      const metricName = metricNameInput?.value?.trim() || '';
      formData.append('metricName', metricName);

      const response = await fetch('/api/import-redfin', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.statusText}`);
      }

      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('text/event-stream')) {
        await handleSSEResponse(response, setImportProgress, setResult, setUploadedFiles);
      } else {
        const responseJson = await response.json();
        setResult(responseJson);
      }
    } catch (error: any) {
      setResult({ success: false, error: error.message });
    } finally {
      setLoading(false);
      setUploadProgress(null);
      e.target.value = '';
    }
  };

  return (
    <div className="mb-8 p-6 bg-white rounded-lg shadow">
      <h2 className="text-xl font-semibold mb-4">Redfin Data Import (Phase 2.2)</h2>

      {/* Verification and Clear Buttons */}
      <div className="mb-4 pb-4 border-b flex flex-wrap gap-4 items-end">
        <div>
          <button
            onClick={() => api.verifyRedfinData()}
            disabled={loading}
            className="px-6 py-3 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Verifying...' : 'Verify Redfin Data'}
          </button>
          <p className="text-xs text-gray-500 mt-1">Check imported data</p>
        </div>
        <div>
          <button
            onClick={api.clearRedfinData}
            disabled={loading}
            className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Deleting...' : 'Clear All Redfin Data'}
          </button>
          <p className="text-xs text-gray-500 mt-1">Delete all Redfin data</p>
        </div>
      </div>

      {/* Manual File Upload */}
      <div className="mt-6 p-6 bg-blue-50 border-2 border-blue-200 rounded-lg">
        <h3 className="text-lg font-semibold mb-3 text-blue-900">Manual File Upload</h3>
        <p className="text-sm text-gray-700 mb-4">
          Download a CSV/TSV file from{' '}
          <a
            href="https://www.redfin.com/news/data-center/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 underline"
          >
            Redfin Data Center
          </a>
          , then upload it here:
        </p>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">
              Metric Name (optional - will auto-detect from file if not provided):
            </label>
            <input
              type="text"
              id="redfin-metric-name"
              placeholder="e.g., median_sale_price, homes_sold, inventory"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={loading}
            />
            <p className="text-xs text-gray-500 mt-1">
              Leave empty to let the importer auto-detect metrics from the file
            </p>
          </div>
          <div className="flex items-center gap-4">
            <label className="cursor-pointer">
              <input
                type="file"
                accept=".csv,.tsv"
                onChange={handleFileUpload}
                disabled={loading}
                className="hidden"
                id="redfin-file-upload"
              />
              <span className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed inline-block">
                {loading ? 'Uploading...' : 'Choose CSV File to Upload'}
              </span>
            </label>
            <span className="text-sm text-gray-600">
              Supports both <strong>"data"</strong> and <strong>"cross tab"</strong> formats. Full import (no row limit).
            </span>
          </div>
        </div>

        {/* Upload Progress */}
        {uploadProgress !== null && (
          <div className="mt-4 w-full">
            <div className="flex items-center justify-between text-sm text-gray-700 mb-1">
              <span>Upload progress</span>
              <span>{uploadProgress}%</span>
            </div>
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-600 transition-all duration-200"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          </div>
        )}

        {/* Import Progress */}
        {importProgress !== null && (
          <div className="mt-4 w-full">
            <div className="flex items-center justify-between text-sm text-gray-700 mb-1">
              <span>{importProgress.message}</span>
              <span>{importProgress.percent}%</span>
            </div>
            <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-green-600 transition-all duration-300"
                style={{ width: `${importProgress.percent}%` }}
              />
            </div>
            <div className="text-xs text-gray-500 mt-1">
              Batch {importProgress.current} of {importProgress.total}
            </div>
          </div>
        )}

        <p className="text-xs text-gray-500 mt-3">
          Tip: After downloading from Redfin, use this button to select and upload the file
        </p>
      </div>

      {/* Uploaded Files List */}
      {uploadedFiles.length > 0 && (
        <UploadedFilesList
          files={uploadedFiles}
          loading={loading}
          verifyFile={(filename) => api.verifyRedfinData(filename)}
          viewAllRecords={(filename) => api.verifyRedfinData(filename, 10000, true)}
        />
      )}
    </div>
  );
}

async function handleSSEResponse(
  response: Response,
  setImportProgress: (progress: ImportProgress | null) => void,
  setResult: (result: any) => void,
  setUploadedFiles: React.Dispatch<React.SetStateAction<UploadedFile[]>>
): Promise<void> {
  const reader = response.body?.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  if (!reader) {
    throw new Error('No response body reader available');
  }

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        try {
          const data = JSON.parse(line.substring(6));

          if (data.type === 'progress' && data.progress) {
            setImportProgress({
              current: data.progress.current,
              total: data.progress.total,
              percent: data.progress.percent,
              message: data.message
            });
          } else if (data.type === 'complete') {
            setResult(data.result);
            setImportProgress(null);
            if (data.result.sourceFileName) {
              setUploadedFiles(prev => [...prev, {
                filename: data.result.sourceFileName,
                timestamp: new Date(),
                result: data.result
              }]);
            }
          } else if (data.type === 'error') {
            setResult({ success: false, error: data.error });
            setImportProgress(null);
            throw new Error(data.error);
          }
        } catch {
          // Skip invalid JSON lines
        }
      }
    }
  }
}

interface UploadedFilesListProps {
  files: UploadedFile[];
  loading: boolean;
  verifyFile: (filename: string) => void;
  viewAllRecords: (filename: string) => void;
}

function UploadedFilesList({ files, loading, verifyFile, viewAllRecords }: UploadedFilesListProps) {
  return (
    <div className="mt-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
      <h3 className="text-md font-semibold mb-3 text-gray-800">Uploaded Files</h3>
      <div className="space-y-2">
        {files.map((file, idx) => (
          <div key={idx} className="flex items-center justify-between p-3 bg-white rounded border border-gray-200">
            <div className="flex-1">
              <div className="font-medium text-sm">{file.filename}</div>
              <div className="text-xs text-gray-500">
                {file.timestamp.toLocaleString()} {' '}
                {file.result?.details?.timeSeriesInserted || 0} records
              </div>
            </div>
            <div className="ml-4 flex gap-2">
              <button
                onClick={() => verifyFile(file.filename)}
                disabled={loading}
                className="px-4 py-2 bg-teal-600 text-white rounded hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
              >
                Verify
              </button>
              <button
                onClick={() => viewAllRecords(file.filename)}
                disabled={loading}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
              >
                View All Records
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
