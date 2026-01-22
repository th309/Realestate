/**
 * Types for ML Workflow Admin Page
 */

export type StepStatus = 'pending' | 'running' | 'completed' | 'error';

export interface WorkflowStep {
  id: string;
  name: string;
  description: string;
  script: string;
  outputs: string[];
  estimatedTime: string;
  viewable?: boolean;
  icon?: string;
}

export interface OutputFile {
  name: string;
  size: string;
  path?: string;
  viewUrl?: string;
}

export interface StepState {
  status: StepStatus;
  lastRunTime: string | null;
  progress?: number;
  error?: string;
  jobId?: string;
  outputs?: OutputFile[];
}

export interface WorkflowStatusResponse {
  success: boolean;
  data: {
    steps: Record<string, StepState>;
  };
  error?: string;
}

export interface RunStepResponse {
  success: boolean;
  data: {
    jobId: string;
  };
  error?: string;
}

export interface JobStatusResponse {
  success: boolean;
  data: {
    status: StepStatus;
    progress?: number;
    error?: string;
    completedAt?: string;
  };
  error?: string;
}
