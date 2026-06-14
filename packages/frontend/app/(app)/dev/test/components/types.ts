/**
 * Test Page Type Definitions
 */

export interface ImportProgress {
  current: number;
  total: number;
  percent: number;
  message: string;
}

export interface UploadedFile {
  filename: string;
  timestamp: Date;
  result: any;
}

export interface TestResult {
  success: boolean;
  error?: string;
  message?: string;
  summary?: {
    totalMarkets: number;
    totalTimeSeriesRecords: number;
    uniqueRegionsWithData: number;
    dateRange: {
      min: string;
      max: string;
      totalMonths: number;
    };
  };
  marketsByType?: Array<{
    type: string;
    count: number;
    sample: Array<{ name: string; state?: string }>;
  }>;
  metricsBreakdown?: Array<{
    metric: string;
    count: number;
    dateRange: { min: string; max: string };
    sampleValues: number[];
  }>;
  sampleRecords?: Array<{
    region: string;
    regionType?: string;
    state?: string;
    date: string;
    metric: string;
    value: number | string;
    regionId: string;
  }>;
  recordCount?: number;
  details?: {
    tierConfigsFound?: number;
    geoDataCount?: number;
    scoresCount?: number;
    totalDataPoints?: number;
    datasets?: string[];
    durationMs?: number;
    stored?: number;
    sampleSize?: number;
    totalRecords?: number;
    timeSeriesInserted?: number;
    errorDetails?: Array<{
      region: string;
      error: string;
      hint?: string;
      code?: string;
    }>;
    environment?: {
      supabaseUrl: string;
      anonKey: string;
      serviceKey: string;
    };
    sourceFileName?: string;
  };
  sample?: any[];
  sourceFileName?: string;
}

export interface TestSectionProps {
  loading: boolean;
  setLoading: React.Dispatch<React.SetStateAction<boolean>>;
  setResult: React.Dispatch<React.SetStateAction<TestResult | null>>;
}

export interface RedfinSectionProps extends TestSectionProps {
  uploadProgress: number | null;
  setUploadProgress: (progress: number | null) => void;
  importProgress: ImportProgress | null;
  setImportProgress: (progress: ImportProgress | null) => void;
  uploadedFiles: UploadedFile[];
  setUploadedFiles: React.Dispatch<React.SetStateAction<UploadedFile[]>>;
}

export interface ZillowFetcherSectionProps extends TestSectionProps {
  zillowDatasets: string;
  setZillowDatasets: (datasets: string) => void;
  storeData: boolean;
  setStoreData: (store: boolean) => void;
}
