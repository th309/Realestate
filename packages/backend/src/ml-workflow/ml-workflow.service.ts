/**
 * ML Workflow Service
 *
 * Manages PropertyIQ ML workflow execution:
 * - Spawns Python scripts as child processes
 * - Tracks job status in database
 * - Parses progress from stdout
 * - Serves output files
 */

import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';

export type StepStatus = 'pending' | 'running' | 'completed' | 'error';

export interface StepState {
  status: StepStatus;
  lastRunTime: string | null;
  progress?: number;
  error?: string;
  jobId?: string;
  outputs?: OutputFile[];
}

export interface OutputFile {
  name: string;
  size: string;
  path?: string;
  viewUrl?: string;
}

export interface JobRecord {
  id: string;
  job_type: string;  // Maps to step_id
  config: Record<string, unknown>;
  status: string;  // 'queued' | 'running' | 'completed' | 'failed'
  progress: number;
  result: Record<string, unknown> | null;
  error: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

// Map step IDs to Python scripts
const STEP_SCRIPTS: Record<string, string> = {
  'data-export': 'export_backtest_data.py',
  'prepare-backtest-data': 'prepare_backtest_data.py',
  'calculate-benchmarks': 'calculate_benchmarks.py',
  'feature-analysis': 'find_optimal_weights.py',
  'score-explanations': 'generate_shap_explanations.py',
  'monthly-report': 'generate_monthly_report.py',
};

// Output file patterns for each step
const STEP_OUTPUTS: Record<string, string[]> = {
  'data-export': [
    'geographies.parquet',
    'zillow_historical.parquet',
    'census_latest.parquet',
    'economic.parquet',
  ],
  'prepare-backtest-data': ['backtest_data.parquet'],
  'calculate-benchmarks': [
    'backtest_with_benchmarks.parquet',
    'benchmarks_national.parquet',
    'benchmarks_regional.parquet',
    'benchmarks_peer.parquet',
  ],
  'feature-analysis': ['feature_importance_*.csv'],
  'score-explanations': ['explanations_*.json'],
  'monthly-report': ['monthly_report_*.json', 'monthly_report_*.html'],
};

@Injectable()
export class MLWorkflowService {
  private readonly logger = new Logger(MLWorkflowService.name);
  private readonly pythonScriptsPath: string;
  private readonly dataPath: string;
  private readonly reportsPath: string;
  private runningProcesses: Map<string, ChildProcess> = new Map();

  constructor(private readonly supabaseService: SupabaseService) {
    // Configure paths - adjust based on your deployment
    const basePath =
      process.env.ML_SCRIPTS_PATH ||
      path.resolve(__dirname, '../../../../propertyiq-ml');
    this.pythonScriptsPath = path.join(basePath, 'scripts');
    this.dataPath = path.join(basePath, 'data');
    this.reportsPath = path.join(basePath, 'reports');

    this.logger.log(`ML Scripts path: ${this.pythonScriptsPath}`);
  }

  /**
   * Get current status of all workflow steps.
   */
  async getWorkflowStatus(): Promise<Record<string, StepState>> {
    const supabase = this.supabaseService.getClient();

    // Get latest job for each step
    const { data: jobs, error } = await supabase
      .from('propertyiq_ml_jobs')
      .select('*')
      .in('job_type', Object.keys(STEP_SCRIPTS))
      .order('created_at', { ascending: false });

    if (error) {
      this.logger.error(`Failed to fetch job status: ${error.message}`);
      throw error;
    }

    // Build step states from jobs (most recent per step)
    const stepStates: Record<string, StepState> = {};
    const seenSteps = new Set<string>();

    for (const job of jobs || []) {
      if (seenSteps.has(job.job_type)) continue;
      seenSteps.add(job.job_type);

      // Map DB status to UI status
      const uiStatus = this.mapDbStatusToUiStatus(job.status);

      stepStates[job.job_type] = {
        status: uiStatus,
        lastRunTime: job.completed_at || job.created_at,
        progress: job.progress,
        error: job.error,
        jobId: job.id,
        outputs: await this.getStepOutputFiles(job.job_type),
      };
    }

    // Add pending state for steps with no jobs
    for (const stepId of Object.keys(STEP_SCRIPTS)) {
      if (!stepStates[stepId]) {
        stepStates[stepId] = {
          status: 'pending',
          lastRunTime: null,
          outputs: await this.getStepOutputFiles(stepId),
        };
      }
    }

    return stepStates;
  }

  /**
   * Map database status to UI status.
   */
  private mapDbStatusToUiStatus(dbStatus: string): StepStatus {
    switch (dbStatus) {
      case 'queued':
        return 'pending';
      case 'running':
        return 'running';
      case 'completed':
        return 'completed';
      case 'failed':
        return 'error';
      default:
        return 'pending';
    }
  }

  /**
   * Run a specific workflow step.
   */
  async runStep(stepId: string): Promise<{ jobId: string }> {
    if (!STEP_SCRIPTS[stepId]) {
      throw new Error(`Unknown step: ${stepId}`);
    }

    const supabase = this.supabaseService.getClient();
    const jobId = crypto.randomUUID();

    // Create job record
    const { error: insertError } = await supabase
      .from('propertyiq_ml_jobs')
      .insert({
        id: jobId,
        job_type: stepId,
        config: { script: STEP_SCRIPTS[stepId] },
        status: 'running',
        progress: 0,
        started_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
      });

    if (insertError) {
      this.logger.error(`Failed to create job record: ${insertError.message}`);
      throw insertError;
    }

    // Spawn Python process
    const scriptPath = path.join(
      this.pythonScriptsPath,
      STEP_SCRIPTS[stepId],
    );
    const pythonPath = process.env.PYTHON_PATH || 'python3';

    this.logger.log(`Running: ${pythonPath} ${scriptPath}`);

    const childProcess = spawn(pythonPath, [scriptPath], {
      cwd: this.pythonScriptsPath,
      env: {
        ...process.env,
        JOB_ID: jobId,
      },
    });

    this.runningProcesses.set(jobId, childProcess);

    // Collect stderr for error reporting
    let stderrOutput = '';

    // Handle stdout (progress updates)
    childProcess.stdout?.on('data', async (data) => {
      const output = data.toString();
      this.logger.debug(`[${stepId}] stdout: ${output}`);

      // Parse progress
      const progressMatch = output.match(/PROGRESS:(\d+)/);
      if (progressMatch) {
        const progress = parseInt(progressMatch[1], 10);
        await this.updateJobProgress(jobId, progress);
      }
    });

    // Handle stderr - collect for error message
    childProcess.stderr?.on('data', (data) => {
      const output = data.toString();
      this.logger.warn(`[${stepId}] stderr: ${output}`);
      // Keep last 1000 chars of stderr for error message
      stderrOutput = (stderrOutput + output).slice(-1000);
    });

    // Handle completion
    childProcess.on('close', async (code) => {
      this.runningProcesses.delete(jobId);

      const status = code === 0 ? 'completed' : 'error';
      let error: string | null = null;
      if (code !== 0) {
        // Include stderr in error message for debugging
        const stderrSummary = stderrOutput.trim();
        error = stderrSummary
          ? `Exit code ${code}: ${stderrSummary}`
          : `Process exited with code ${code}`;
      }

      await this.updateJobStatus(jobId, status, error);
      this.logger.log(`[${stepId}] completed with code ${code}`);
    });

    // Handle errors
    childProcess.on('error', async (err) => {
      this.runningProcesses.delete(jobId);
      await this.updateJobStatus(jobId, 'error', err.message);
      this.logger.error(`[${stepId}] process error: ${err.message}`);
    });

    return { jobId };
  }

  /**
   * Get status of a specific job.
   */
  async getJobStatus(jobId: string): Promise<JobRecord | null> {
    const supabase = this.supabaseService.getClient();

    const { data, error } = await supabase
      .from('propertyiq_ml_jobs')
      .select('*')
      .eq('id', jobId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      throw error;
    }

    return data as JobRecord;
  }

  /**
   * Get output files for a step.
   */
  async getStepOutputFiles(stepId: string): Promise<OutputFile[]> {
    const patterns = STEP_OUTPUTS[stepId] || [];
    const outputs: OutputFile[] = [];

    // Determine which directory to look in
    const searchDir =
      stepId === 'monthly-report' ? this.reportsPath : this.dataPath;

    if (!fs.existsSync(searchDir)) {
      return outputs;
    }

    const files = fs.readdirSync(searchDir);

    for (const pattern of patterns) {
      // Convert glob pattern to regex
      const regex = new RegExp(
        '^' + pattern.replace(/\*/g, '.*').replace(/\./g, '\\.') + '$',
      );

      for (const file of files) {
        if (regex.test(file)) {
          const filePath = path.join(searchDir, file);
          const stats = fs.statSync(filePath);

          const output: OutputFile = {
            name: file,
            size: this.formatFileSize(stats.size),
            path: filePath,
          };

          // Add view URL for HTML files
          if (file.endsWith('.html')) {
            output.viewUrl = `/api/admin/ml-workflow/outputs/${stepId}/${file}`;
          }

          outputs.push(output);
        }
      }
    }

    // Sort by modification time (newest first)
    outputs.sort((a, b) => {
      if (!a.path || !b.path) return 0;
      const aTime = fs.statSync(a.path).mtime.getTime();
      const bTime = fs.statSync(b.path).mtime.getTime();
      return bTime - aTime;
    });

    return outputs;
  }

  /**
   * Get a specific output file.
   */
  getOutputFile(
    stepId: string,
    filename: string,
  ): { content: Buffer; contentType: string } | null {
    const searchDir =
      stepId === 'monthly-report' ? this.reportsPath : this.dataPath;
    const filePath = path.join(searchDir, filename);

    // Security: prevent directory traversal
    if (!filePath.startsWith(searchDir)) {
      return null;
    }

    if (!fs.existsSync(filePath)) {
      return null;
    }

    const content = fs.readFileSync(filePath);
    let contentType = 'application/octet-stream';

    if (filename.endsWith('.html')) {
      contentType = 'text/html';
    } else if (filename.endsWith('.json')) {
      contentType = 'application/json';
    } else if (filename.endsWith('.csv')) {
      contentType = 'text/csv';
    } else if (filename.endsWith('.parquet')) {
      contentType = 'application/octet-stream';
    }

    return { content, contentType };
  }

  /**
   * Update job progress.
   */
  private async updateJobProgress(jobId: string, progress: number) {
    const supabase = this.supabaseService.getClient();

    await supabase
      .from('propertyiq_ml_jobs')
      .update({
        progress,
      })
      .eq('id', jobId);
  }

  /**
   * Update job status.
   */
  private async updateJobStatus(
    jobId: string,
    status: StepStatus,
    error?: string | null,
  ) {
    const supabase = this.supabaseService.getClient();

    // Map UI status to DB status
    const dbStatus = status === 'error' ? 'failed' : status;

    const update: Record<string, unknown> = {
      status: dbStatus,
    };

    if (status === 'completed' || status === 'error') {
      update.completed_at = new Date().toISOString();
      if (status === 'completed') {
        update.progress = 100;
      }
    }

    if (error) {
      update.error = error;
    }

    await supabase.from('propertyiq_ml_jobs').update(update).eq('id', jobId);
  }

  /**
   * Format file size for display.
   */
  private formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024)
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  }
}
