/** Shared helpers for backfill scripts: date generation, checkpoints, CLI parsing. */

import * as path from 'path';
import * as fs from 'fs';
import { GeographyLevel } from '../scoring/formula-weights';

// ── Date utilities ──────────────────────────────────────────────────────────

function pad2(value: number): string {
  return value.toString().padStart(2, '0');
}

export function parseDateUtc(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, (m || 1) - 1, d || 1));
}

export function formatMonthStartUtc(date: Date): string {
  return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-01`;
}

export function normalizeToMonthStart(dateStr: string): string {
  const date = parseDateUtc(dateStr);
  date.setUTCDate(1);
  return formatMonthStartUtc(date);
}

export function getDefaultStartDate(endDate: string, years: number): string {
  const end = parseDateUtc(endDate);
  end.setUTCDate(1);
  const start = new Date(end);
  start.setUTCFullYear(start.getUTCFullYear() - years);
  return formatMonthStartUtc(start);
}

export function generateMonthlyDates(
  startDate: string,
  endDate: string,
): string[] {
  const dates: string[] = [];
  const start = parseDateUtc(startDate);
  const end = parseDateUtc(endDate);
  start.setUTCDate(1);
  end.setUTCDate(1);

  const current = new Date(start);
  while (current <= end) {
    dates.push(formatMonthStartUtc(current));
    current.setUTCMonth(current.getUTCMonth() + 1);
  }
  return dates;
}

export function generateQuarterlyDates(
  startDate: string,
  endDate: string,
): string[] {
  const dates: string[] = [];
  const start = parseDateUtc(startDate);
  const end = parseDateUtc(endDate);
  start.setUTCDate(1);
  end.setUTCDate(1);

  const startQuarterMonth = Math.floor(start.getUTCMonth() / 3) * 3;
  const quarterStart = new Date(
    Date.UTC(start.getUTCFullYear(), startQuarterMonth, 1),
  );
  if (quarterStart < start) {
    quarterStart.setUTCMonth(quarterStart.getUTCMonth() + 3);
  }

  const current = new Date(quarterStart);
  while (current <= end) {
    dates.push(formatMonthStartUtc(current));
    current.setUTCMonth(current.getUTCMonth() + 3);
  }
  return dates;
}

export function formatElapsed(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const mins = Math.floor(ms / 60000);
  const secs = Math.floor((ms % 60000) / 1000);
  return `${mins}m ${secs}s`;
}

// ── Checkpoint persistence ──────────────────────────────────────────────────

const CHECKPOINT_DIR = path.resolve(__dirname, '../../../../data/checkpoints');

interface CheckpointData {
  completed: string[];
  lastUpdated: string;
}

export function getCheckpointPath(name: string): string {
  return path.join(CHECKPOINT_DIR, `${name}.json`);
}

export function loadCheckpoint(filePath: string): Set<string> {
  try {
    if (fs.existsSync(filePath)) {
      const data: CheckpointData = JSON.parse(
        fs.readFileSync(filePath, 'utf-8'),
      );
      return new Set(data.completed);
    }
  } catch {
    /* corrupted file — start fresh */
  }
  return new Set();
}

export function saveCheckpoint(filePath: string, completed: Set<string>): void {
  fs.mkdirSync(CHECKPOINT_DIR, { recursive: true });
  const data: CheckpointData = {
    completed: [...completed],
    lastUpdated: new Date().toISOString(),
  };
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

export function clearCheckpoint(filePath: string): void {
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
}

// ── .env loader (for scripts run outside NestJS CLI) ────────────────────────

export function loadEnvFile(): void {
  const envFilePath = path.resolve(__dirname, '../../.env');
  if (!fs.existsSync(envFilePath)) return;

  const envContent = fs.readFileSync(envFilePath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed
      .slice(eqIdx + 1)
      .trim()
      .replace(/^["']|["']$/g, '');
    if (!process.env[key]) process.env[key] = val;
  }
}

// ── CLI arg parsing ─────────────────────────────────────────────────────────

export interface BackfillCliArgs {
  startDate: string | null;
  endDate: string;
  years: number | null;
  geography: GeographyLevel | 'all';
  zipFrequency: 'monthly' | 'quarterly';
  dryRun: boolean;
  resetCheckpoint: boolean;
}

export function parseBackfillArgs(): BackfillCliArgs {
  const args = process.argv.slice(2);
  const result: BackfillCliArgs = {
    endDate: new Date().toISOString().slice(0, 10),
    startDate: null,
    years: 5,
    geography: 'all',
    zipFrequency: 'quarterly',
    dryRun: false,
    resetCheckpoint: false,
  };

  for (const arg of args) {
    if (arg.startsWith('--start-date=')) {
      result.startDate = arg.replace('--start-date=', '');
    } else if (arg.startsWith('--end-date=')) {
      result.endDate = arg.replace('--end-date=', '');
    } else if (arg.startsWith('--years=')) {
      const years = parseInt(arg.replace('--years=', ''), 10);
      result.years = Number.isFinite(years) && years > 0 ? years : result.years;
    } else if (arg.startsWith('--geography=')) {
      const geo = arg.replace('--geography=', '').toLowerCase();
      if (['metro', 'county', 'zip', 'all'].includes(geo)) {
        result.geography = geo as GeographyLevel | 'all';
      }
    } else if (arg.startsWith('--zip-frequency=')) {
      const freq = arg.replace('--zip-frequency=', '').toLowerCase();
      if (freq === 'monthly' || freq === 'quarterly') {
        result.zipFrequency = freq;
      }
    } else if (arg === '--dry-run') {
      result.dryRun = true;
    } else if (arg === '--reset-checkpoint') {
      result.resetCheckpoint = true;
    }
  }

  return result;
}
